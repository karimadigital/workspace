import sys
import os
import re

PERSONAL_EMAILS = ['hello@karima.digital', 'karima@firstbatch.xyz', 'karima@hype.partners']
SERVICE_EMAILS = ['@lu.ma', '@events.lu.ma', 'luma@', 'calendar-invite@', 'heartbeat.chat']
PERSONAL_EVENT_TITLES = ['Mom mode', 'Gym', 'Busy', 'Na', 'Parent Coffee', 'Thrust <> Hype Weekly']

def categorize_contact(event_summary):
    """Auto-categorize based on event context"""
    if not event_summary:
        return 'General Adivsor'
    
    event = event_summary.lower()
    
    if any(k in event for k in ['pitch', 'partner', 'collab', 'meeting']):
        return 'Partner'
    elif any(k in event for k in ['advisor', 'advice', 'strategy']):
        return 'General Adivsor'
    elif any(k in event for k in ['journalist', 'press', 'media', 'story']):
        return 'Journalist'
    
    return 'General Adivsor'

def extract_company(event_summary):
    """Extract company from event title"""
    if not event_summary:
        return ''
    
    if ' <> ' in event_summary:
        parts = event_summary.split(' <> ')
        if len(parts) > 1:
            return parts[1].strip()
    
    return ''

def is_service_email(email):
    """Check if email is a service email"""
    return any(pattern in email for pattern in SERVICE_EMAILS)

def main():
    print("CRM Sync - Daily Calendar to Airtable")
    print("This script will be run by the scheduled agent.")

if __name__ == '__main__':
    main()
