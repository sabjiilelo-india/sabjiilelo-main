import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradientFallback } from '../components/Hero';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Input, Screen, T, colors, font } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function send() {
    setError(null);
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit mobile number');
    setBusy(true);
    try {
      const r = await api.auth.requestOtp(phone);
      setHint(r.devHint ? `Testing mode: OTP is ${r.devHint}` : null);
      setStep('otp');
      setResendIn(30);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(otp = code) {
    if (otp.length !== 4) return setError('Enter the 4-digit OTP');
    setError(null);
    setBusy(true);
    try {
      await login(phone, otp);
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} padded={false}>
        <LinearGradientFallback style={{ paddingTop: 40, paddingBottom: 36, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          <Image source={require('../assets/logo.png')} style={{ width: 120, height: 120 }} contentFit="contain" />
          <T v="script" style={{ color: '#9be36f', fontSize: 30, marginTop: 6 }}>
            Fresh from the farm
          </T>
          <T style={{ color: 'rgba(255,255,255,0.85)' }}>at your door, every morning</T>
        </LinearGradientFallback>

        <View style={{ padding: 24 }}>
          {step === 'phone' ? (
            <>
              <T v="h1">Login or sign up</T>
              <T v="small" style={{ marginTop: 4, marginBottom: 20 }}>
                Customers, delivery partners and vendors sign in with their mobile number.
              </T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ height: 48, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.beige, justifyContent: 'center' }}>
                  <T style={{ fontFamily: font.medium }}>+91</T>
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
                    style={{ fontSize: 17, letterSpacing: 1 }}
                  />
                </View>
              </View>
              {error && <T style={{ color: colors.danger, marginBottom: 8 }}>{error}</T>}
              <Button title="Get OTP" size="lg" loading={busy} onPress={send} />
            </>
          ) : (
            <>
              <Pressable onPress={() => setStep('phone')}>
                <T style={{ color: colors.primary, marginBottom: 12 }}>← Change number</T>
              </Pressable>
              <T v="h1">Enter OTP</T>
              <T v="small" style={{ marginTop: 4 }}>Sent to +91 {phone}</T>
              {hint && (
                <View style={{ backgroundColor: colors['light-green'], padding: 10, borderRadius: 10, marginTop: 12 }}>
                  <T style={{ color: colors.primary }}>{hint}</T>
                </View>
              )}
              {/* Four boxes backed by one hidden input, so SMS autofill still works. */}
              <Pressable onPress={() => otpRef.current?.focus()} style={{ flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 14 }}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 60,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: code.length === i ? colors.primary : code[i] ? '#86b79b' : colors.line,
                      backgroundColor: '#fff',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T style={{ fontFamily: font.bold, fontSize: 26, color: colors.ink }}>{code[i] ?? ''}</T>
                  </View>
                ))}
              </Pressable>
              <TextInput
                ref={otpRef}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={4}
                value={code}
                onChangeText={(t) => {
                  const v = t.replace(/\D/g, '').slice(0, 4);
                  setCode(v);
                  if (v.length === 4 && !busy) verify(v);
                }}
                style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
              />
              {error && <T style={{ color: colors.danger, marginBottom: 8 }}>{error}</T>}
              <Button title="Verify & continue" size="lg" loading={busy} disabled={code.length !== 4} onPress={() => verify()} />
              <Pressable disabled={resendIn > 0} onPress={send} style={{ marginTop: 16, alignItems: 'center' }}>
                <T style={{ color: resendIn > 0 ? colors.muted : colors.primary }}>{resendIn > 0 ? `Resend OTP in ${resendIn}s` : 'Resend OTP'}</T>
              </Pressable>
            </>
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
