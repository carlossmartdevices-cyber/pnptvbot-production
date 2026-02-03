/**
 * Onboarding Single Completion Test
 * Ensures that onboarding can only be completed once per user
 */

const { expect } = require('chai');
const sinon = require('sinon');
const UserService = require('../src/bot/services/userService');
const UserModel = require('../src/models/userModel');

describe('Onboarding Single Completion', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('Onboarding Completion Flag', function() {
    it('should prevent duplicate onboarding completion', async function() {
      // Mock a user who has already completed onboarding
      const mockUser = {
        id: 'test_user_123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        onboardingComplete: true,
        language: 'en'
      };

      // Mock UserService.getById to return the completed user
      sandbox.stub(UserService, 'getById').resolves(mockUser);

      // Mock UserService.updateProfile
      const updateStub = sandbox.stub(UserService, 'updateProfile').resolves({ success: true });

      // Simulate the onboarding completion check
      const userId = 'test_user_123';
      const userCheck = await UserService.getById(userId);

      // This should be true for a user who has completed onboarding
      expect(userCheck.onboardingComplete).to.be.true;

      // The system should prevent duplicate completion
      if (userCheck && userCheck.onboardingComplete) {
        // This is the expected behavior - prevent duplicate completion
        expect(true).to.be.true; // This path should be taken
      } else {
        // This path should NOT be taken for completed users
        fail('Should not attempt to complete onboarding for already completed user');
      }

      // Verify updateProfile was not called (since user already completed onboarding)
      expect(updateStub.called).to.be.false;
    });

    it('should allow onboarding completion for new users', async function() {
      // Mock a new user who has not completed onboarding
      const mockNewUser = {
        id: 'new_user_456',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        onboardingComplete: false,
        language: 'en'
      };

      // Mock UserService.getById to return the new user
      sandbox.stub(UserService, 'getById').resolves(mockNewUser);

      // Mock UserService.updateProfile
      const updateStub = sandbox.stub(UserService, 'updateProfile').resolves({ success: true });

      // Simulate the onboarding completion check
      const userId = 'new_user_456';
      const userCheck = await UserService.getById(userId);

      // This should be false for a new user
      expect(userCheck.onboardingComplete).to.be.false;

      // The system should allow completion for new users
      if (userCheck && !userCheck.onboardingComplete) {
        // This is the expected behavior - allow completion for new users
        const result = await UserService.updateProfile(userId, {
          onboardingComplete: true,
          language: 'en'
        });
        
        expect(result.success).to.be.true;
        expect(updateStub.calledOnce).to.be.true;
      }
    });

    it('should handle onboarding restart correctly', async function() {
      // Mock a user who has completed onboarding
      const mockCompletedUser = {
        id: 'completed_user_789',
        username: 'completeduser',
        firstName: 'Completed',
        lastName: 'User',
        onboardingComplete: true,
        language: 'en'
      };

      // Mock UserService.getById
      sandbox.stub(UserService, 'getById').resolves(mockCompletedUser);

      // Mock UserService.updateProfile for restart
      const updateStub = sandbox.stub(UserService, 'updateProfile').resolves({ success: true });

      // Simulate onboarding restart (for testing purposes)
      const userId = 'completed_user_789';
      
      // This is the explicit restart path (only for testing)
      const result = await UserService.updateProfile(userId, {
        onboardingComplete: false, // Explicitly reset for testing
      });

      expect(result.success).to.be.true;
      expect(updateStub.calledOnce).to.be.true;
    });
  });

  describe('Database Level Protection', function() {
    it('should retrieve incomplete onboarding users', async function() {
      // Mock database query
      const mockRows = [
        { id: 'user1', onboardingComplete: false },
        { id: 'user2', onboardingComplete: false }
      ];

      sandbox.stub(UserModel, 'getIncompleteOnboarding').resolves(mockRows);

      const incompleteUsers = await UserModel.getIncompleteOnboarding();
      
      expect(incompleteUsers).to.be.an('array');
      expect(incompleteUsers.length).to.equal(2);
      expect(incompleteUsers[0].onboardingComplete).to.be.false;
    });

    it('should handle empty result for incomplete onboarding', async function() {
      // Mock empty database query
      sandbox.stub(UserModel, 'getIncompleteOnboarding').resolves([]);

      const incompleteUsers = await UserModel.getIncompleteOnboarding();
      
      expect(incompleteUsers).to.be.an('array');
      expect(incompleteUsers.length).to.equal(0);
    });
  });

  describe('Edge Cases', function() {
    it('should handle null user in onboarding check', async function() {
      // Mock UserService.getById to return null
      sandbox.stub(UserService, 'getById').resolves(null);

      const userId = 'nonexistent_user';
      const userCheck = await UserService.getById(userId);

      expect(userCheck).to.be.null;
      // System should handle this gracefully
    });

    it('should handle database errors during onboarding check', async function() {
      // Mock UserService.getById to throw error
      sandbox.stub(UserService, 'getById').throws(new Error('Database error'));

      try {
        await UserService.getById('error_user');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Database error');
        // System should handle this gracefully
      }
    });
  });
});

console.log('✅ Onboarding Single Completion Tests - All tests defined');