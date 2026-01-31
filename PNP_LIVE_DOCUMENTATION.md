# PNP Live Documentation

## Overview

PNP Live is a new feature that allows users to have private 1-on-1 video calls with performers. It replaces the old "pnp latino live" and "Private 1:1 Call" features, providing a more robust and user-friendly experience.

## For Users

### Booking a Private Call

1.  Open the bot and go to the "PNP Live" section.
2.  You will see a list of available performers who are currently online.
3.  You can view a performer's profile by clicking the "View Profile" button.
4.  To book a call, click the "Book" button next to the performer's name.
5.  You will be prompted to pay for the call.
6.  After a successful payment, you can schedule the call. You can either start the call immediately or schedule it for a later time.
7.  You will receive a confirmation message with the meeting link.

### Viewing a Performer's Profile

When you see a list of available performers, you can click the "View Profile" button to see more details about them, including their bio, rates, and tags.

## For Performers

### Setting Your Status

1.  As a performer, you can use the `/pnp_live` command to open the performer menu.
2.  In the menu, you can toggle your status between "online" and "offline".
3.  When you go online, a broadcast will be sent to all users to notify them that you are available for calls.

### Managing Your Profile

1.  In the performer menu (`/pnp_live`), you can click the "Manage Profile" button to edit your profile.
2.  You can edit your bio, rates, and tags.

## For Admins

### Managing Performer Roles

1.  As a superadmin, you can use the `/admin` command to open the admin panel.
2.  Go to "Roles" to manage user roles.
3.  You can add or remove the "Performer" role from users.

## Technical Details

### Services and Models

The new PNP Live feature is built on a new set of services and models:

*   **`ComprehensiveAvailabilityService`:** Manages performers' availability, including recurring schedules and blocked dates.
*   **`BookingAvailabilityIntegration`:** Integrates the availability service with the booking system, providing a "smart" booking experience.
*   **`BookingModel`:** The data model for bookings, with a complete lifecycle (draft, held, awaiting_payment, confirmed, etc.).
*   **`PerformerProfileModel`:** Stores additional information about performers.
*   **`roleService`:** Manages user roles.
*   **`videoCallService`:** Generates meeting links.

### Meeting Link Generation

The system uses **Daily.co** to generate meeting links for the video calls. The user requested a "jaas link", which might mean Jitsi as a Service. The current implementation uses Daily.co, and this can be changed in the future if needed.
