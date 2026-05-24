import { Router } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = [
      '.txt', '.docx', '.csv', '.xlsx', '.xls',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${ext}`));
    }
  },
});

router.post(
  '/',
  upload.fields([
    { name: 'smsTemplate', maxCount: 1 },
    { name: 'personasFile', maxCount: 1 },
  ]),
  (req, res, next) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;

      if (!files?.smsTemplate?.[0] || !files?.personasFile?.[0]) {
        res.status(400).json({ error: 'Both smsTemplate and personasFile are required' });
        return;
      }

      const smsFile = files.smsTemplate[0];
      const personasFile = files.personasFile[0];
      const campaignId = uuidv4();

      res.json({
        campaignId,
        files: {
          smsTemplate: smsFile.filename,
          personasFile: personasFile.filename,
        },
        message: 'Files uploaded successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
