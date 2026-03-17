import multer from 'multer';

// Use memory storage so we can pass the buffer directly to Supabase Storage.
const storage = multer.memoryStorage();

export const uploadSingleImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('file');

