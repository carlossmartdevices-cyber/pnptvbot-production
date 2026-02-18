/**
 * Unit Tests for LocationCapture Component
 * Tests GPS permission flow, location updates, and error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LocationCapture from '../../../webapps/nearby/src/components/LocationCapture';
import LocationService from '../../../webapps/nearby/src/services/locationService';

// Mock LocationService
jest.mock('../../../webapps/nearby/src/services/locationService', () => ({
  updateLocation: jest.fn().mockResolvedValue({ success: true }),
  startHeartbeat: jest.fn(),
  stopHeartbeat: jest.fn(),
  getCurrentLocation: jest.fn(),
  isTracking: jest.fn(),
  getTimeSinceLastUpdate: jest.fn()
}));

// Mock navigator.geolocation
const mockGeolocation = {
  watchPosition: jest.fn(),
  clearWatch: jest.fn()
};

Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true
});

describe('LocationCapture Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGeolocation.watchPosition.mockClear();
    mockGeolocation.clearWatch.mockClear();
  });

  // Test 1: Component renders correctly
  test('should render with initial idle state', () => {
    render(<LocationCapture />);

    expect(screen.getByText('My Location')).toBeInTheDocument();
    expect(screen.getByText('Location tracking off')).toBeInTheDocument();
    expect(screen.getByText('📍 Enable Location')).toBeInTheDocument();
  });

  // Test 2: Request geolocation permission
  test('should request geolocation permission on button click', async () => {
    const onLocationUpdate = jest.fn();
    render(<LocationCapture onLocationUpdate={onLocationUpdate} />);

    const button = screen.getByText('📍 Enable Location');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGeolocation.watchPosition).toHaveBeenCalled();
    });
  });

  // Test 3: Handle permission granted
  test('should show tracking state when permission granted', async () => {
    const onLocationUpdate = jest.fn();
    render(<LocationCapture onLocationUpdate={onLocationUpdate} />);

    // Setup mock geolocation with success callback
    mockGeolocation.watchPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 40.7505,
          longitude: -73.9706,
          accuracy: 10
        }
      });
      return 1; // watch ID
    });

    const button = screen.getByText('📍 Enable Location');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Tracking location')).toBeInTheDocument();
    });
  });

  // Test 4: Handle permission denied
  test('should show error when permission denied', async () => {
    const onError = jest.fn();
    render(<LocationCapture onError={onError} />);

    // Setup mock to trigger permission denied error
    mockGeolocation.watchPosition.mockImplementation((success, error) => {
      error({ code: error.PERMISSION_DENIED });
      return 1;
    });

    const button = screen.getByText('📍 Enable Location');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    });
  });

  // Test 5: Display coordinates
  test('should display coordinates when location captured', async () => {
    const onLocationUpdate = jest.fn();
    render(<LocationCapture onLocationUpdate={onLocationUpdate} />);

    mockGeolocation.watchPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 40.7505,
          longitude: -73.9706,
          accuracy: 10
        }
      });
      return 1;
    });

    const button = screen.getByText('📍 Enable Location');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/40\.7505/)).toBeInTheDocument();
      expect(screen.getByText(/73\.9706/)).toBeInTheDocument();
    });
  });

  // Test 6: Display accuracy indicator
  test('should show accuracy in good range', async () => {
    const onLocationUpdate = jest.fn();
    render(<LocationCapture onLocationUpdate={onLocationUpdate} />);

    mockGeolocation.watchPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 40.7505,
          longitude: -73.9706,
          accuracy: 25 // Good range: 10-50m
        }
      });
      return 1;
    });

    const button = screen.getByText('📍 Enable Location');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Good \(< 50m\)/)).toBeInTheDocument();
    });
  });

  // Test 7: Stop tracking
  test('should stop tracking when stop button clicked', async () => {
    const onLocationUpdate = jest.fn();
    render(<LocationCapture onLocationUpdate={onLocationUpdate} />);

    mockGeolocation.watchPosition.mockReturnValue(1);
    mockGeolocation.watchPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 40.7505,
          longitude: -73.9706,
          accuracy: 10
        }
      });
      return 1;
    });

    const enableButton = screen.getByText('📍 Enable Location');
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(screen.getByText('Tracking location')).toBeInTheDocument();
    });

    const stopButton = screen.getByText('✖️ Stop Tracking');
    fireEvent.click(stopButton);

    expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(1);
    expect(screen.getByText('Location tracking off')).toBeInTheDocument();
  });

  // Test 8: Handle timeout error
  test('should handle geolocation timeout', async () => {
    const onError = jest.fn();
    render(<LocationCapture onError={onError} />);

    mockGeolocation.watchPosition.mockImplementation((success, error) => {
      error({ code: error.TIMEOUT });
      return 1;
    });

    const button = screen.getByText('📍 Enable Location');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/timed out/i)).toBeInTheDocument();
    });
  });

  // Test 9: Call onLocationUpdate callback
  test('should call onLocationUpdate callback when location captured', async () => {
    const onLocationUpdate = jest.fn();
    render(<LocationCapture onLocationUpdate={onLocationUpdate} />);

    mockGeolocation.watchPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 40.7505,
          longitude: -73.9706,
          accuracy: 10
        }
      });
      return 1;
    });

    const button = screen.getByText('📍 Enable Location');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onLocationUpdate).toHaveBeenCalledWith({
        latitude: 40.7505,
        longitude: -73.9706,
        accuracy: 10
      });
    });
  });

  // Test 10: Handle unavailable position
  test('should handle position unavailable error', async () => {
    const onError = jest.fn();
    render(<LocationCapture onError={onError} />);

    mockGeolocation.watchPosition.mockImplementation((success, error) => {
      error({ code: error.POSITION_UNAVAILABLE });
      return 1;
    });

    const button = screen.getByText('📍 Enable Location');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
    });
  });

  // Test 11: Accuracy bar width calculation
  test('should calculate accuracy bar width based on accuracy', async () => {
    const onLocationUpdate = jest.fn();
    const { container } = render(<LocationCapture onLocationUpdate={onLocationUpdate} />);

    mockGeolocation.watchPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 40.7505,
          longitude: -73.9706,
          accuracy: 20
        }
      });
      return 1;
    });

    const button = screen.getByText('📍 Enable Location');
    fireEvent.click(button);

    await waitFor(() => {
      // Bar width should be: max(0, min(100, 100 - accuracy/10))
      // For accuracy=20: 100 - 20/10 = 100 - 2 = 98%
      const barFill = container.querySelector('.accuracy-bar-fill');
      expect(barFill).toHaveStyle('width: 98%');
    });
  });
});
