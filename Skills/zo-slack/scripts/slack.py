#!/usr/bin/env python3
"""Slack integration script for Zo"""

import os
import sys
import json
import argparse

try:
    from slack_sdk import WebClient
    from slack_sdk.errors import SlackApiError
except ImportError:
    print("Installing slack-sdk...")
    os.system("pip install slack-sdk")
    from slack_sdk import WebClient
    from slack_sdk.errors import SlackApiError


def get_client():
    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        print("Error: SLACK_BOT_TOKEN not found. Add it in Settings > Advanced.")
        sys.exit(1)
    return WebClient(token=token)


def send_channel(client, channel, message):
    """Send message to a channel (by name or ID)"""
    try:
        # If channel doesn't start with #, add it
        channel_id = channel
        if not channel.startswith("#") and not channel.startswith("C") and not channel.startswith("G"):
            channel = f"#{channel}"
        
        # Try to find channel by name
        if channel.startswith("#"):
            result = client.conversations_list(types="public_channel,private_channel")
            for ch in result["channels"]:
                if ch["name"] == channel[1:]:
                    channel_id = ch["id"]
                    break
        
        response = client.chat_postMessage(channel=channel_id, text=message)
        print(f"✓ Message sent to {channel}")
        return response
    except SlackApiError as e:
        print(f"Error: {e.response['error']}")
        sys.exit(1)


def send_dm(client, user, message):
    """Send DM to a user"""
    try:
        # Get user ID from mention
        user_id = user
        if user.startswith("@"):
            result = client.users_list()
            for u in result["members"]:
                if u["name"] == user[1:]:
                    user_id = u["id"]
                    break
        
        # Open DM conversation
        response = client.conversations_open(users=user_id)
        channel_id = response["channel"]["id"]
        
        # Send message
        client.chat_postMessage(channel=channel_id, text=message)
        print(f"✓ DM sent to {user}")
    except SlackApiError as e:
        print(f"Error: {e.response['error']}")
        sys.exit(1)


def list_channels(client):
    """List all channels"""
    try:
        result = client.conversations_list(types="public_channel,private_channel")
        print("\n📋 Channels:")
        for ch in result["channels"]:
            print(f"  {ch['name']} (ID: {ch['id']})")
    except SlackApiError as e:
        print(f"Error: {e.response['error']}")
        sys.exit(1)


def send_thread(client, channel, ts, message):
    """Reply to a thread"""
    try:
        client.chat_postMessage(channel=channel, text=message, thread_ts=ts)
        print("✓ Reply sent to thread")
    except SlackApiError as e:
        print(f"Error: {e.response['error']}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Slack integration for Zo")
    parser.add_argument("command", help="Command: send, dm, channels, thread")
    parser.add_argument("args", nargs="*", help="Arguments for the command")
    
    args = parser.parse_args()
    client = get_client()
    
    if args.command == "send" and len(args.args) >= 2:
        channel = args.args[0]
        message = " ".join(args.args[1:])
        send_channel(client, channel, message)
    elif args.command == "dm" and len(args.args) >= 2:
        user = args.args[0]
        message = " ".join(args.args[1:])
        send_dm(client, user, message)
    elif args.command == "channels":
        list_channels(client)
    elif args.command == "thread" and len(args.args) >= 3:
        channel = args.args[0]
        ts = args.args[1]
        message = " ".join(args.args[2:])
        send_thread(client, channel, ts, message)
    else:
        print("Usage:")
        print("  slack send #channel <message>")
        print("  slack dm @user <message>")
        print("  slack channels")
        print("  slack thread <channel-id> <ts> <message>")
        sys.exit(1)


if __name__ == "__main__":
    main()
