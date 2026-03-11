
'use client';

import React from 'react';
import Link from 'next/link';
import { Swords, User, Shield, LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthDialog } from '@/components/auth/auth-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Skeleton } from '../ui/skeleton';
import { useTheme } from "next-themes";
import { WarningLink } from '@/hooks/use-navigation-warning';

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <Button 
      variant="ghost" 
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}


export default function AppHeader() {
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
          title: "Выход выполнен",
          description: "Вы успешно вышли из системы.",
      });
    } catch (error) {
       toast({
          title: "Ошибка выхода",
          description: "Что-то пошло не так.",
          variant: "destructive"
      });
    }
  };
  
  const renderUserAuth = () => {
    if (loading) {
      return <Skeleton className="h-10 w-28" />;
    }

    if (user) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatarUrl} alt={user.username} />
                <AvatarFallback>{user.username ? user.username.charAt(0).toUpperCase() : '?'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.username}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
             <DropdownMenuItem asChild>
                <WarningLink href="/profile"><User className="mr-2 h-4 w-4" /><span>Профиль</span></WarningLink>
            </DropdownMenuItem>
            {user.role === 'admin' && (
                <DropdownMenuItem asChild>
                     <WarningLink href="/admin"><Shield className="mr-2 h-4 w-4" /><span>Панель админа</span></WarningLink>
                </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Выйти</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    
    return (
      <AuthDialog>
        <Button>
          <User className="mr-2 h-4 w-4" /> Вход / Регистрация
        </Button>
      </AuthDialog>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <WarningLink href="/" className="mr-6 flex items-center space-x-2">
            <Swords className="h-6 w-6 text-primary" />
            <span className="font-bold font-headline">LoL Predict</span>
          </WarningLink>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <WarningLink href="/predictions" className="transition-colors hover:text-primary">Прогнозы</WarningLink>
            <WarningLink href="/matches" className="transition-colors hover:text-primary">Матчи</WarningLink>
            <WarningLink href="/rankings" className="transition-colors hover:text-primary">Рейтинги</WarningLink>
            <WarningLink href="/seasons" className="transition-colors hover:text-primary">Сезоны</WarningLink>
            {!loading && user && (
              <WarningLink href="/profile" className="transition-colors hover:text-primary">Мой профиль</WarningLink>
            )}
             {!loading && user && user.role === 'admin' && (
              <WarningLink href="/admin" className="transition-colors hover:text-primary">Панель админа</WarningLink>
            )}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <ThemeSwitcher />
          {renderUserAuth()}
        </div>
      </div>
    </header>
  );
}
