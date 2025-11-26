// Mock for firebase-admin
const mockFirestore = {
  collection: jest.fn(() => mockCollection),
  settings: jest.fn(),
};

const mockDoc = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockCollection = {
  doc: jest.fn(() => mockDoc),
  where: jest.fn(() => mockCollection),
  orderBy: jest.fn(() => mockCollection),
  limit: jest.fn(() => mockCollection),
  startAfter: jest.fn(() => mockCollection),
  get: jest.fn(),
  add: jest.fn(),
};

const mockAdmin = {
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(() => ({})),
  },
  firestore: jest.fn(() => mockFirestore),
};

// Export mocks for test access
mockAdmin.__mockFirestore = mockFirestore;
mockAdmin.__mockCollection = mockCollection;
mockAdmin.__mockDoc = mockDoc;

module.exports = mockAdmin;
