import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../types';
import { uploadSingleImage } from '../middleware/upload';

const router = Router();

function logAvatarApi(method: string, path: string, userId?: string, success?: boolean, error?: string) {
  const msg = userId
    ? `[API] ${method} ${path} user_id=${userId} ${success ? 'OK' : `FAIL: ${error}`}`
    : `[API] ${method} ${path} ${success === false ? `FAIL: ${error}` : ''}`;
  console.log(msg, { timestamp: new Date().toISOString() });
}

/**
 * POST /api/profile/avatar
 *
 * Accepts a single image file (multipart/form-data, field "file") and uploads
 * it to the "profile_avatars" storage bucket. Updates profiles.profile_picture_url
 * with the resulting public URL and returns the URL.
 */
router.post<unknown, ApiResponse<{ profile_picture_url: string }> | ApiResponse>(
  '/',
  uploadSingleImage,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || (req.query.user_id as string);

    if (!userId) {
      logAvatarApi('POST', '/api/profile/avatar', undefined, false, 'Missing user_id');
      res.status(400).json({ success: false, error: 'Missing user_id (X-User-Id header or user_id query param)' });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const ext = file.originalname.split('.').pop() || 'jpg';
    const path = `avatars/${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('profile_avatars')
      .upload(path, file.buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.mimetype,
      });

    if (uploadError) {
      logAvatarApi('POST', '/api/profile/avatar', userId, false, uploadError.message);
      res.status(500).json({ success: false, error: 'Failed to upload avatar' });
      return;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('profile_avatars')
      .getPublicUrl(path);

    const profile_picture_url = publicUrlData.publicUrl;

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ profile_picture_url })
      .eq('id', userId);

    if (profileError) {
      logAvatarApi('POST', '/api/profile/avatar', userId, false, profileError.message);
      res.status(500).json({ success: false, error: 'Failed to update profile picture' });
      return;
    }

    logAvatarApi('POST', '/api/profile/avatar', userId, true);
    res.json({ success: true, data: { profile_picture_url } });
  })
);

export default router;

