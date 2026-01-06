const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '../../../../public/uploads/videorama');

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeBasename(name) {
  const base = path.basename(name || 'video');
  return base.replace(/[^\w.\-]+/g, '_');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureUploadDir();
      cb(null, UPLOAD_DIR);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 16);
    const base = safeBasename(path.basename(file.originalname || 'video', ext));
    const stamp = Date.now();
    cb(null, `${stamp}-${base}${ext || ''}`);
  },
});

function fileFilter(req, file, cb) {
  const ok = typeof file.mimetype === 'string' && file.mimetype.startsWith('video/');
  cb(ok ? null : new Error('Only video uploads are allowed'), ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 250 * 1024 * 1024, // 250MB
    files: 1,
  },
});

async function uploadVideo(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file received' });
  }

  const publicUrl = `/uploads/videorama/${encodeURIComponent(req.file.filename)}`;
  return res.json({
    success: true,
    file: {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: publicUrl,
    },
  });
}

module.exports = {
  upload,
  uploadVideo,
};

