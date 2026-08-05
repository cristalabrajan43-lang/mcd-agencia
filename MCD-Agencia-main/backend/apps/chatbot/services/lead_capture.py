"""
Lead auto-capture from chatbot conversations.

Detects when users share contact information (email, phone)
in chat messages and automatically creates a Lead record
for the sales team to follow up.
"""

import logging
import re

from apps.chatbot.models import Lead, Conversation

logger = logging.getLogger(__name__)

# Patterns for detecting contact information
EMAIL_PATTERN = re.compile(
    r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    re.IGNORECASE,
)

PHONE_PATTERN = re.compile(
    r'(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}',
)

# Minimum message count before we try to extract leads
MIN_MESSAGES_FOR_LEAD = 2


def try_capture_lead(conversation: Conversation, message_text: str, request=None) -> bool:
    """
    Attempt to detect contact info in a chat message and create a Lead.

    Only captures if:
        - The conversation doesn't already have a lead
        - An email or phone is found in the message
        - The conversation has at least MIN_MESSAGES_FOR_LEAD messages

    Args:
        conversation: The current Conversation instance
        message_text: The user's message text
        request: Optional HTTP request for IP/UA tracking

    Returns:
        True if a lead was created, False otherwise
    """
    # Skip if conversation already has a lead
    if conversation.lead_id:
        return False

    # Skip if too few messages (user probably hasn't engaged enough)
    msg_count = conversation.messages.count()
    if msg_count < MIN_MESSAGES_FOR_LEAD:
        return False

    # Try to detect email
    email_match = EMAIL_PATTERN.search(message_text)
    email = email_match.group(0) if email_match else ''

    # Try to detect phone
    phone_match = PHONE_PATTERN.search(message_text)
    phone = phone_match.group(0).strip() if phone_match else ''

    if not email and not phone:
        return False

    # Don't capture MCD's own contact info
    if email and any(
        domain in email.lower()
        for domain in ['agenciamcd.mx', 'agenciamcd.com', 'example.com']
    ):
        return False

    try:
        # Check if lead already exists with this email
        if email and Lead.objects.filter(email=email).exists():
            # Link existing lead to conversation
            lead = Lead.objects.filter(email=email).first()
            conversation.lead = lead
            conversation.save(update_fields=['lead', 'updated_at'])
            logger.info(f'Linked existing lead {lead.id} to conversation {conversation.session_id}')
            return False  # Not a new lead

        # Extract name from conversation history (look for greetings)
        name = _extract_name_from_history(conversation) or 'Chat Lead'

        # Build lead data
        lead_data = {
            'name': name,
            'email': email or 'no-email@chatbot.local',
            'phone': phone,
            'source': 'chatbot',
            'status': 'new',
            'message': f'Auto-captured from chat session {conversation.session_id[:8]}',
            'notes': f'Contact info detected in chat message.\nSession: {conversation.session_id}',
        }

        # Add request metadata if available
        if request:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                lead_data['ip_address'] = x_forwarded_for.split(',')[0].strip()
            else:
                lead_data['ip_address'] = request.META.get('REMOTE_ADDR')
            lead_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')[:500]

        lead = Lead.objects.create(**lead_data)
        conversation.lead = lead
        conversation.save(update_fields=['lead', 'updated_at'])

        logger.info(f'Auto-captured lead {lead.id} from chat session {conversation.session_id}')
        return True

    except Exception as e:
        logger.warning(f'Failed to auto-capture lead: {e}')
        return False


def _extract_name_from_history(conversation: Conversation) -> str:
    """
    Try to extract a name from conversation history.

    Looks for patterns like "me llamo X", "soy X", "my name is X".
    Returns empty string if no name found.
    """
    messages = conversation.messages.filter(role='user').order_by('created_at')[:10]

    name_patterns = [
        re.compile(r'(?:me llamo|mi nombre es|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)', re.IGNORECASE),
        re.compile(r'(?:my name is|i\'m|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', re.IGNORECASE),
    ]

    for msg in messages:
        for pattern in name_patterns:
            match = pattern.search(msg.content)
            if match:
                return match.group(1).strip()

    return ''
