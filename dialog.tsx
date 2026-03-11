
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import type { User } from '@/lib/types';


interface AuthDialogProps {
  children: React.ReactNode;
}

export function AuthDialog({ children }: AuthDialogProps) {
  const [open, setOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const { toast } = useToast();
  
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'sorf17@mail.ru';

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast({ title: 'Ошибка', description: 'Пожалуйста, заполните все поля.', variant: 'destructive' });
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      toast({ title: 'Успешно', description: 'Вы успешно вошли в систему!' });
      setOpen(false); // Just close the dialog, context will handle the rest
    } catch (error: any) {
      toast({ title: 'Ошибка входа', description: error.message, variant: 'destructive' });
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword || !signupUsername) {
      toast({ title: 'Ошибка', description: 'Пожалуйста, заполните все поля.', variant: 'destructive' });
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
      const user = userCredential.user;

      const newUser: Omit<User, 'id'> = {
        username: signupUsername,
        email: signupEmail,
        role: signupEmail.toLowerCase() === adminEmail.toLowerCase() ? 'admin' : 'user',
        score: 0,
        allTimeScore: 0,
      };

      await setDoc(doc(db, "users", user.uid), newUser);
      
      toast({ title: 'Регистрация успешна', description: `Добро пожаловать, ${signupUsername}!` });
      setOpen(false); // Just close the dialog, context will handle the rest
    } catch (error: any) {
       toast({ title: 'Ошибка регистрации', description: error.message, variant: 'destructive' });
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
        toast({ title: "Ошибка", description: "Пожалуйста, введите ваш email.", variant: "destructive" });
        return;
    }
    try {
        await sendPasswordResetEmail(auth, resetEmail);
        toast({ title: "Письмо отправлено", description: "Проверьте свою почту для сброса пароля." });
        setOpen(false);
    } catch (error: any) {
        toast({ title: "Ошибка сброса пароля", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Аутентификация</DialogTitle>
          <DialogDescription>
            Войдите или создайте учетную запись, чтобы начать делать прогнозы.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">Вход</TabsTrigger>
            <TabsTrigger value="signup">Регистрация</TabsTrigger>
            <TabsTrigger value="reset">Сброс пароля</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLoginSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="login-email" className="text-right">
                    Email
                  </Label>
                  <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="login-password" className="text-right">
                    Пароль
                  </Label>
                  <Input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="col-span-3" />
                </div>
                <Button type="submit" variant="default">Войти</Button>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={handleSignupSubmit}>
              <div className="grid gap-4 py-4">
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="signup-username" className="text-right">
                    Имя пользователя
                  </Label>
                  <Input id="signup-username" value={signupUsername} onChange={(e) => setSignupUsername(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="signup-email" className="text-right">
                    Email
                  </Label>
                  <Input id="signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="signup-password"  className="text-right">
                    Пароль
                  </Label>
                  <Input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} className="col-span-3" />
                </div>
                <Button type="submit" variant="default">Создать аккаунт</Button>
              </div>
            </form>
          </TabsContent>
           <TabsContent value="reset">
            <form onSubmit={handlePasswordReset}>
              <div className="grid gap-4 py-4">
                <p className="text-sm text-muted-foreground px-1">
                    Введите свой email, и мы отправим вам ссылку для сброса пароля.
                </p>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="reset-email" className="text-right">
                    Email
                  </Label>
                  <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="col-span-3" />
                </div>
                <Button type="submit" variant="default">Отправить письмо</Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

