# AI Form Autofill Browser Extension

A browser extension designed to simplify form filling by using your personal profile data. It detects forms on web pages, matches fields intelligently, and fills them automatically.

## Features

- **Smart Form Detection**: Automatically detects forms on web pages.
- **Profile-Based Filling**: Uses your saved profile data to fill forms accurately.
- **Progress Tracking**: Tracks profile completion to improve filling accuracy.
- **Customizable Preferences**: Configure detection, notifications, and more.
- **Multi-Form Support**: Handles multiple forms on a single page.

## How It Works

1. **Form Detection**: The extension scans web pages for forms and fields.
2. **Field Matching**: Matches form fields with your profile data using a scoring system.
3. **Auto-Fill**: Automatically fills matched fields with your data.
4. **AI Integration**: Handles open-ended questions with AI-generated suggestions.

## System Overview

- **Popup Interface**: Manage login, profile, and detected forms.
- **Options Page**: Edit your profile and configure preferences.
- **Content Script**: Detects forms and fills them on web pages.
- **Background Service**: Manages user data and communication services.

## Installation

1. Open `chrome://extensions/` in your browser.
2. Enable "Developer mode."
3. Click "Load unpacked" and select the `public` folder.
4. The extension will appear in your toolbar.

## Usage

1. **Login/Register**: Use the popup to log in or register.
2. **Complete Profile**: Fill in your profile via the options page.
3. **Auto-Fill Forms**: Navigate to a webpage, and the extension will detect and fill forms automatically.

## Customization

- Enable or disable form detection.
- Configure notifications and history saving.
- Edit field mappings for better accuracy.

## Supported Browsers

- Chrome, Edge, Brave, and Opera (Manifest V3 compatible).

This extension provides a simple and efficient way to handle repetitive form filling tasks.