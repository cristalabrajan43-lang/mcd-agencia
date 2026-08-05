from django.contrib import admin
from .models import PageView, TrackEvent


@admin.register(PageView)
class PageViewAdmin(admin.ModelAdmin):
    list_display = ('page_path', 'device_type', 'ip_address', 'timestamp')
    list_filter = ('device_type', 'timestamp')
    search_fields = ('page_path', 'ip_address', 'session_id')
    readonly_fields = ('id',)
    date_hierarchy = 'timestamp'


@admin.register(TrackEvent)
class TrackEventAdmin(admin.ModelAdmin):
    list_display = ('event_name', 'page_url', 'ip_address', 'timestamp')
    list_filter = ('event_name', 'timestamp')
    search_fields = ('event_name', 'session_id')
    readonly_fields = ('id',)
    date_hierarchy = 'timestamp'
