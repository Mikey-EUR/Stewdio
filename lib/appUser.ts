import type { SupabaseClient } from '@supabase/supabase-js';

export interface AppUserProfile {
  appUserId: string;
  username: string;
}

/**
 * Finds the app_users row for this email, auto-creating it if this is the user's
 * first time signing in on the web — mirrors the mobile app's
 * AuthService.checkOrCreateUserAuthorization() so new users aren't left
 * authenticated-but-unrecognized (stuck/signed-out) like before this existed.
 * New rows are only created for emails invited via Supabase Auth, same as mobile.
 */
export async function getOrCreateAppUser(supabase: SupabaseClient, email: string): Promise<AppUserProfile | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: existing } = await supabase
    .from('app_users')
    .select('app_user_id, username, is_active')
    .eq('user_email_address', normalizedEmail)
    .maybeSingle();

  if (existing?.app_user_id && existing.is_active !== false) {
    return { appUserId: existing.app_user_id, username: existing.username ?? '' };
  }

  const { data: isInvited } = await supabase.rpc('check_user_invited', { user_email: normalizedEmail });
  if (!isInvited) return null;

  const { data: group } = await supabase
    .from('user_groups')
    .select('user_group_id')
    .eq('group_name', 'editor')
    .single();
  if (!group?.user_group_id) return null;

  const username = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const { data: created, error } = await supabase
    .from('app_users')
    .insert({
      user_email_address: normalizedEmail,
      username,
      user_group_id: group.user_group_id,
      is_active: true,
    })
    .select('app_user_id, username')
    .single();

  if (error || !created?.app_user_id) return null;
  return { appUserId: created.app_user_id, username: created.username ?? '' };
}
