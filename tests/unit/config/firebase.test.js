// Simple Firebase configuration tests
describe('Firebase Configuration', () => {
  it('should export required functions', () => {
    // Mock before requiring
    jest.mock('firebase-admin', () => ({
      initializeApp: jest.fn(),
      credential: {
        cert: jest.fn(),
      },
      firestore: jest.fn(() => ({
        settings: jest.fn(),
      })),
    }));

    const firebase = require('../../../src/config/firebase');

    expect(firebase.initializeFirebase).toBeInstanceOf(Function);
    expect(firebase.getFirestore).toBeInstanceOf(Function);
    expect(firebase.getAdmin).toBeInstanceOf(Function);
  });

  it('should have createIndexes function', () => {
    const firebase = require('../../../src/config/firebase');
    expect(firebase.createIndexes).toBeInstanceOf(Function);
  });
});
