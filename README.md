# AI Form Autofill Browser Extension

An intelligent browser extension that uses AI to automatically fill forms with your personal information, making online form completion faster and more accurate.

## Features

### 🤖 AI-Powered Form Filling
- Intelligent field detection and matching
- Context-aware suggestions for open-ended questions
- Support for various form types (registration, profile, application forms)

### 👤 User Profile Management
- Secure user authentication (login/register)
- Comprehensive profile creation with optional sections
- Profile completion progress tracking
- Edit profile through dedicated options page

### 🔍 Smart Form Detection
- Automatic form detection on web pages
- Manual form detection trigger
- Support for multiple forms per page
- Field categorization (personal, professional, academic, startup)

### 🔧 Customizable Settings
- Auto-detection preferences
- Notifications control
- History management
- Custom API endpoint configuration

## Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Search for "AI Form Autofill"
3. Click "Add to Chrome"
4. Follow the installation prompts

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `autofill-extention/public` folder
5. The extension will appear in your extensions list

## Usage

### Initial Setup
1. Click the extension icon in your browser toolbar
2. Register a new account or login with existing credentials
3. Complete your profile information
   - Fill required fields (First Name, Last Name)
   - Add optional information for better accuracy
   - Use toggle buttons to show/hide optional sections

### Filling Forms
1. Navigate to any webpage with forms
2. Click the extension icon
3. Click "Detect Forms" to scan the current page
4. Select the detected form you want to fill
5. Review and confirm the auto-filled information

### Managing Your Profile
1. Click "Edit Profile" from the extension popup
2. Update your information in the options page
3. Changes are automatically saved and synced

## Project Structure

```
autofill-extention/
├── public/
│   ├── manifest.json          # Extension manifest
│   ├── popup.html            # Main popup interface
│   ├── popup.js              # Popup logic and management
│   ├── popup.css             # Popup styling
│   ├── options.html          # Options page interface
│   ├── options.js            # Options page logic
│   ├── options.css           # Options page styling
│   ├── background.js         # Background service worker
│   ├── content.js            # Content script for form detection
│   ├── countries.json        # Country data for dropdowns
│   ├── field-mappings.json   # Field mapping configurations
│   ├── manager/
│   │   ├── authHandler.js    # Authentication management
│   │   ├── formHandler.js    # Form detection and filling
│   │   ├── dropdownHandler.js # Dropdown population
│   │   └── aiHandler.js      # AI suggestions integration
│   └── utils/
│       ├── constants.js      # Application constants
│       ├── domUtils.js       # DOM manipulation utilities
│       ├── formUtils.js      # Form processing utilities
│       └── logUtils.js       # Logging utilities
└── README.md
```

## Configuration

### Default Settings
- Auto-detect forms: Enabled
- Show notifications: Enabled
- Save history: Enabled
- API URL: `http://localhost:5000/api`

### Customizing Settings
1. Right-click the extension icon → "Options"
2. Or click "Edit Profile" from the popup
3. Adjust preferences in the "Preferences" section
4. Click "Save Preferences"

## Supported Form Fields

### Personal Information
- First Name, Last Name
- Email, Phone Number
- Date of Birth, Gender
- Address, City, Country, Postal Code
- Hobbies, Personal Description

### Professional Information
- Job Title, Company Name
- Years of Experience
- Skills and Expertise
- LinkedIn, GitHub, Portfolio URLs

### Academic Information
- Degree, Institution
- Graduation Year
- Field of Study

### Startup/Project Information
- Project Name, Summary
- Mission Statement
- Problem Statement & Solution
- Team Members, Video URLs

## Troubleshooting

### Extension Not Loading
- Ensure you're using Chrome/Chromium-based browser
- Check that Developer Mode is enabled
- Reload the extension from `chrome://extensions/`

### Forms Not Detected
- Try clicking "Detect Forms" manually
- Ensure the page has loaded completely
- Check if forms are inside iframes (not currently supported)

### Profile Not Saving
- Check your internet connection
- Verify the backend server is running
- Check browser console for error messages

### Login Issues
- Verify your credentials
- Check if the backend API is accessible
- Clear extension data: `chrome://extensions/` → Details → "Extension options"

## Development

### Prerequisites
- Chrome browser (version 88+)
- Node.js (for development tools)
- Backend API server running

### Development Setup
1. Clone the repository
2. Navigate to `autofill-extention/public`
3. Load the extension in developer mode
4. Make changes and reload the extension to test

### File Modifications
- **popup.js**: Main extension logic
- **options.js**: Profile management
- **background.js**: Service worker and API communication
- **content.js**: Page content interaction
- **HTML/CSS files**: User interface

### Testing
1. Load extension in developer mode
2. Test on various websites with forms
3. Check browser console for errors
4. Verify API communication in Network tab

## Privacy & Security

- All personal data is stored securely on your backend server
- Passwords are hashed and never stored in plain text
- Form data is only sent to your configured API endpoint
- No data is shared with third parties
- Local storage only contains authentication tokens

## Browser Compatibility

- ✅ Chrome 88+
- ✅ Microsoft Edge 88+
- ✅ Brave Browser
- ✅ Opera 74+
- ❌ Firefox (Manifest V3 support limited)
- ❌ Safari (Not supported)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review browser console errors
- Ensure backend API is running and accessible

## Changelog

### Version 1.0.0
- Initial release
- Basic form detection and filling
- User authentication and profile management
- AI-powered suggestions
- Options page for profile editing