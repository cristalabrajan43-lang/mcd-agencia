"""
Content URLs for MCD-Agencia.

This module provides URL routing for content endpoints:
    - Landing page data
    - Carousel slides
    - Testimonials
    - Client logos
    - FAQs
    - Branches
    - Legal pages
    - Site configuration
    - Contact form
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    LandingPageView,
    ContactFormView,
    CarouselSlideViewSet,
    PromoBannerViewSet,
    TestimonialViewSet,
    ClientLogoViewSet,
    ServiceViewSet,
    ServiceImageViewSet,
    PortfolioVideoViewSet,
    PortfolioItemViewSet,
    FAQViewSet,
    BranchViewSet,
    LegalPageViewSet,
    SiteConfigurationView,
)

app_name = 'content'

router = DefaultRouter()
router.register('carousel', CarouselSlideViewSet, basename='carousel')
router.register('promo-banners', PromoBannerViewSet, basename='promo-banners')
router.register('services', ServiceViewSet, basename='services')
router.register('service-images', ServiceImageViewSet, basename='service-images')
router.register('portfolio-videos', PortfolioVideoViewSet, basename='portfolio-videos')
router.register('portfolio-items', PortfolioItemViewSet, basename='portfolio-items')
router.register('testimonials', TestimonialViewSet, basename='testimonials')
router.register('clients', ClientLogoViewSet, basename='clients')
router.register('faqs', FAQViewSet, basename='faqs')
router.register('branches', BranchViewSet, basename='branches')
router.register('legal', LegalPageViewSet, basename='legal')

urlpatterns = [
    # Public endpoints
    path('landing/', LandingPageView.as_view(), name='landing'),
    path('contact/', ContactFormView.as_view(), name='contact'),
    path('config/', SiteConfigurationView.as_view(), name='config'),

    # ViewSets
    path('', include(router.urls)),
]
