import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.txt', '.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

router.post(
  '/',
  upload.fields([
    { name: 'smsTemplate', maxCount: 1 },
    { name: 'personasFile', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]>;

    if (!files?.smsTemplate?.[0] || !files?.personasFile?.[0]) {
      res.status(400).json({ error: 'Both smsTemplate and personasFile are required' });
      return;
    }

    const campaignId = uuidv4();
    const smsTemplatePath = files.smsTemplate[0].path;
    const personasFilePath = files.personasFile[0].path;

    res.json({
      campaignId,
      files: {
        smsTemplate: smsTemplatePath,
        personasFile: personasFilePath,
      },
    });
  }
);

export default router;
