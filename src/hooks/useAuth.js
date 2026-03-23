import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  useEffect(() => {
    // 현재 세션 가져오기
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUser(session?.user ?? null);
      setLoading(false);
    });

    // 상태 변경 감시
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUser = (user) => {
    setUser(user);
    if (user) {
      // 명시적으로 false가 아닌 경우(새 유저 등)는 모두 설정이 필요한 것으로 간주
      setNeedsPasswordSetup(user.user_metadata?.needs_password_setup !== false);
    } else {
      setNeedsPasswordSetup(false);
    }
  };

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
