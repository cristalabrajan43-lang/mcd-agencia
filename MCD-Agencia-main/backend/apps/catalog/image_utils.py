"""
Image processing utilities for catalog images.

Provides automatic optimization, resizing, and WebP conversion
for product images to ensure fast page loads.
"""

import io
from PIL import Image as PILImage
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import InMemoryUploadedFile

# Image size configurations by use case
IMAGE_PROFILES = {
    # Landing page - high quality for visual impact
    'hero': {
        'max_size': (1920, 1080),  # Full HD for hero/carousel
        'quality': 90,
    },
    'landing': {
        'max_size': (1600, 1200),  # Large sections
        'quality': 88,
    },
    # Catalog - balanced quality/size
    'product_detail': {
        'max_size': (1200, 1200),  # Product detail page
        'quality': 85,
    },
    'product_card': {
        'max_size': (600, 600),    # Product cards/listings
        'quality': 82,
    },
    'thumbnail': {
        'max_size': (150, 150),    # Thumbnails, admin
        'quality': 75,
    },
}

# Legacy compatibility
IMAGE_SIZES = {
    'large': (1200, 1200),
    'medium': (600, 600),
    'thumbnail': (150, 150),
}

# Quality settings
JPEG_QUALITY = 85
WEBP_QUALITY = 80
MAX_FILE_SIZE_MB = 10  # Increased for landing images


def optimize_image(image_file, max_size=(1200, 1200), quality=85, convert_to_webp=True, profile=None):
    """
    Optimize an uploaded image for web use.

    Args:
        image_file: Django uploaded file or file-like object
        max_size: Maximum dimensions (width, height) - ignored if profile is set
        quality: Output quality (1-100) - ignored if profile is set
        convert_to_webp: Whether to convert to WebP format
        profile: Optional profile name ('hero', 'landing', 'product_detail', 'product_card', 'thumbnail')

    Returns:
        Tuple of (optimized_file, new_filename)
    """
    # Use profile settings if provided
    if profile and profile in IMAGE_PROFILES:
        profile_settings = IMAGE_PROFILES[profile]
        max_size = profile_settings['max_size']
        quality = profile_settings['quality']

    # Open image with Pillow
    img = PILImage.open(image_file)

    # Convert to RGB if necessary (handles PNG with transparency, etc.)
    if img.mode in ('RGBA', 'P'):
        # Create white background for transparent images
        background = PILImage.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Resize if larger than max_size while maintaining aspect ratio
    img.thumbnail(max_size, PILImage.Resampling.LANCZOS)

    # Prepare output
    output = io.BytesIO()

    # Get original filename
    original_name = getattr(image_file, 'name', 'image.jpg')
    base_name = original_name.rsplit('.', 1)[0] if '.' in original_name else original_name

    if convert_to_webp:
        # Save as WebP
        img.save(output, format='WEBP', quality=quality, method=6)
        new_filename = f"{base_name}.webp"
        content_type = 'image/webp'
    else:
        # Save as JPEG
        img.save(output, format='JPEG', quality=quality, optimize=True)
        new_filename = f"{base_name}.jpg"
        content_type = 'image/jpeg'

    output.seek(0)

    # Create new InMemoryUploadedFile
    optimized_file = InMemoryUploadedFile(
        file=output,
        field_name='image',
        name=new_filename,
        content_type=content_type,
        size=output.getbuffer().nbytes,
        charset=None
    )

    return optimized_file, new_filename


def create_thumbnail(image_file, size=(150, 150)):
    """
    Create a thumbnail version of an image.

    Args:
        image_file: Django uploaded file
        size: Thumbnail dimensions

    Returns:
        ContentFile with thumbnail
    """
    img = PILImage.open(image_file)

    # Convert to RGB
    if img.mode not in ('RGB', 'L'):
        img = img.convert('RGB')

    # Create thumbnail
    img.thumbnail(size, PILImage.Resampling.LANCZOS)

    output = io.BytesIO()
    img.save(output, format='WEBP', quality=75)
    output.seek(0)

    return ContentFile(output.read())


def validate_image(image_file):
    """
    Validate an uploaded image.

    Args:
        image_file: Django uploaded file

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check file size
    if image_file.size > MAX_FILE_SIZE_MB * 1024 * 1024:
        return False, f"Image size exceeds {MAX_FILE_SIZE_MB}MB limit"

    # Check if it's a valid image
    try:
        img = PILImage.open(image_file)
        img.verify()
        # Reset file pointer after verify
        image_file.seek(0)
    except Exception:
        return False, "Invalid image file"

    # Check format
    allowed_formats = ['JPEG', 'PNG', 'WEBP', 'GIF']
    img = PILImage.open(image_file)
    if img.format not in allowed_formats:
        return False, f"Image format must be one of: {', '.join(allowed_formats)}"

    image_file.seek(0)
    return True, None


def get_image_dimensions(image_file):
    """Get image dimensions."""
    img = PILImage.open(image_file)
    image_file.seek(0)
    return img.size


def optimize_for_landing(image_file, image_type='hero'):
    """
    Optimize an image for landing page use.

    Uses higher quality settings for visual impact while still
    converting to WebP for efficient delivery.

    Args:
        image_file: Django uploaded file
        image_type: 'hero' for carousel/hero, 'landing' for sections

    Returns:
        Tuple of (optimized_file, new_filename)
    """
    profile = image_type if image_type in ('hero', 'landing') else 'hero'
    return optimize_image(image_file, profile=profile)


def optimize_for_catalog(image_file, image_type='product_detail'):
    """
    Optimize an image for catalog use.

    Uses balanced quality/size settings for product images.

    Args:
        image_file: Django uploaded file
        image_type: 'product_detail', 'product_card', or 'thumbnail'

    Returns:
        Tuple of (optimized_file, new_filename)
    """
    profile = image_type if image_type in ('product_detail', 'product_card', 'thumbnail') else 'product_detail'
    return optimize_image(image_file, profile=profile)
