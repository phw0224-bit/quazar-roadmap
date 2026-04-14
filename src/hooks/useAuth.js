/**
 * @fileoverview Supabase Auth 세션 관리 + 신규 사용자 프로필 설정 플로우.
 *
 * 신규 사용자는 user_metadata.needs_password_setup=true 플래그를 가짐.
 * SetupProfileForm 완료 후 updateProfileAndStep()으로 플래그 제거 + profiles 테이블 upsert.
 *
 * @returns {{ user, loading, needsPasswordSetup, login, logout, updateProfileAndStep }}
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_PROFILE_CUSTOMIZATION, toCustomizationPayload } from '../lib/profileAppearance';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  const handleUser = (user) => {
    setUser(user);
    if (user) {
      setNeedsPasswordSetup(user.user_metadata?.needs_password_setup !== false);
    } else {
      setNeedsPasswordSetup(false);
    }
  };

  useEffect(() => {
    // 현재 세션 가져오기
    const initializeAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        const message = String(error.message || '');
        const isInvalidRefreshToken =
          message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found');

        if (isInvalidRefreshToken) {
          // Stale local session: clear and continue as logged-out user.
          await supabase.auth.signOut({ scope: 'local' });
          handleUser(null);
          setLoading(false);
          return;
        }

        handleUser(null);
        setLoading(false);
        return;
      }

      handleUser(data.session?.user ?? null);
      setLoading(false);
    };

    initializeAuth();

    // 상태 변경 감시
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updateProfileAndStep = async ({ password, name, department }) => {
    // 1. 비밀번호 업데이트 및 메타데이터 플래그 제거
    const { error: authError } = await supabase.auth.updateUser({
      password,
      data: { needs_password_setup: false, name, department }
    });
    if (authError) throw authError;

    // 2. profiles 테이블에 정보 저장
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      name,
      department,
      updated_at: new Date().toISOString()
    });
    if (profileError) throw profileError;

    const { error: customizationError } = await supabase.from('profile_customizations').upsert(
      {
        user_id: user.id,
        ...toCustomizationPayload(DEFAULT_PROFILE_CUSTOMIZATION),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (customizationError) throw customizationError;

    setNeedsPasswordSetup(false);
  };

  return {
    user,
    loading,
    needsPasswordSetup,
    login,
    logout,
    updateProfileAndStep
  };
};
