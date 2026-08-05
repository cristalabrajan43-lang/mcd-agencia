import requests
import base64

JIRA_URL = 'https://utacapulco-team-n54gkv7k.atlassian.net'
JIRA_EMAIL = 'yamamotoherrera.cesaralejandro@utacapulco.edu.mx'
JIRA_API_TOKEN = 'YOUR_JIRA_API_TOKEN'  # Replace with your actual token

HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
}

auth_string = base64.b64encode(f'{JIRA_EMAIL}:{JIRA_API_TOKEN}'.encode()).decode()
HEADERS['Authorization'] = f'Basic {auth_string}'

print('Testing Create Issue...')

# Test creating a simple issue
payload = {
    "fields": {
        "project": {"key": "MCD"},
        "summary": "Test Issue",
        "issuetype": {"name": "Historia"},
    }
}

print('\nAttempting POST to /rest/api/3/issues')
response = requests.post(f'{JIRA_URL}/rest/api/3/issues', json=payload, headers=HEADERS)
print(f'Status: {response.status_code}')
print(f'Response: {response.text[:500]}')

print('\n' + '=' * 80)
