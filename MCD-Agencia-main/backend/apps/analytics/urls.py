from django.urls import path
from . import views

app_name = 'analytics'

urlpatterns = [
    # Public — receives batched events from the frontend
    path('events/', views.ingest_events, name='ingest-events'),
    # Admin — aggregated dashboard data
    path('summary/', views.analytics_summary, name='summary'),
]
