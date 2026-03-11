
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { Shield, User as UserIcon, Edit, BarChart3, Archive, Award as AwardIcon } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, Timestamp, updateDoc, orderBy } from 'firebase/firestore';
import type { Prediction, Match, User, Season } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

interface PredictionWithMatch extends Prediction {
    match: Match | null;
}

interface ScoreByLeague {
    [leagueName: string]: number;
}

function AwardBadge({ rank, title, size = "md" }: { rank: number, title: string, size?: "sm" | "md" }) {
  const colors = {
    1: { bg: 'url(#gold-grad)', text: '#451a03', border: '#fde047', shadow: 'rgba(234, 179, 8, 0.5)' },
    2: { bg: 'url(#silver-grad)', text: '#0f172a', border: '#e2e8f0', shadow: 'rgba(148, 163, 184, 0.5)' },
    3: { bg: 'url(#bronze-grad)', text: '#451a03', border: '#fdba74', shadow: 'rgba(194, 65, 12, 0.5)' },
  }[rank] || { bg: 'url(#neutral-grad)', text: '#ffffff', border: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.5)' };

  const yearMatch = title.match(/\d{4}/);
  const year = yearMatch ? yearMatch[0] : '';
  const shortYear = year ? `'${year.slice(-2)}` : '';

  const dim = size === "sm" ? "w-10 h-10" : "w-14 h-14";

  return (
    <div className={cn("relative flex-shrink-0 select-none", dim)} style={{ filter: `drop-shadow(0 4px 6px ${colors.shadow})` }}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#fef08a' }} />
            <stop offset="50%" style={{ stopColor: '#eab308' }} />
            <stop offset="100%" style={{ stopColor: '#a16207' }} />
          </linearGradient>
          <linearGradient id="silver-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#f8fafc' }} />
            <stop offset="50%" style={{ stopColor: '#94a3b8' }} />
            <stop offset="100%" style={{ stopColor: '#475569' }} />
          </linearGradient>
          <linearGradient id="bronze-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#ffedd5' }} />
            <stop offset="50%" style={{ stopColor: '#d97706' }} />
            <stop offset="100%" style={{ stopColor: '#7c2d12' }} />
          </linearGradient>
          <linearGradient id="neutral-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#60a5fa' }} />
            <stop offset="50%" style={{ stopColor: '#2563eb' }} />
            <stop offset="100%" style={{ stopColor: '#1e3a8a' }} />
          </linearGradient>
        </defs>
        
        <path d="M50 5 L95 50 L50 95 L5 50 Z" fill={colors.bg} stroke={colors.border} strokeWidth="3" />
        <path d="M50 12 L88 50 L50 88 L12 50 Z" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        {year && <path d="M25 15 L75 15 L80 28 L20 28 Z" fill="#000" opacity="0.8" />}
      </svg>
      
      {year && (
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 text-[7px] font-black text-white z-10 tracking-tighter opacity-90">
          {year}
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center font-black text-2xl z-20 pointer-events-none drop-shadow-sm" style={{ color: colors.text }}>
        {rank}
      </div>

      {shortYear && (
        <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#0f172a] rounded-full flex items-center justify-center text-[8px] font-black text-white border-2 border-primary z-30 shadow-lg">
          {shortYear}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [predictions, setPredictions] = useState<PredictionWithMatch[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [scoringSettings, setScoringSettings] = useState({ winnerPoints: 25, scorePoints: 50 });
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    setNewAvatarUrl(user.avatarUrl || '');
    setNewUsername(user.username || '');

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const settingsDocRef = doc(db, 'settings', 'scoring');
            // Corrected: Predictions are in the user's subcollection
            const predictionsQuery = collection(db, 'users', user.id, 'predictions');
            const seasonsQuery = query(collection(db, 'seasons'), orderBy('createdAt', 'desc'));
            
            const [settingsDoc, predictionsSnapshot, seasonsSnapshot] = await Promise.all([
                getDoc(settingsDocRef),
                getDocs(predictionsQuery),
                getDocs(seasonsQuery)
            ]);

            const currentScoringSettings = settingsDoc.exists() 
              ? settingsDoc.data() as { winnerPoints: number, scorePoints: number } 
              : { winnerPoints: 25, scorePoints: 50 };
            setScoringSettings(currentScoringSettings);
            
            setSeasons(seasonsSnapshot.docs.map(s => ({ id: s.id, ...s.data() } as Season)));

            const userPredictions = predictionsSnapshot.docs.map(p => ({ id: p.id, ...p.data() } as Prediction));
            
            const predictionsWithMatches = await Promise.all(
                userPredictions.map(async (prediction) => {
                    const matchDocRef = doc(db, 'matches', prediction.matchId);
                    const matchDoc = await getDoc(matchDocRef);
                    const match = matchDoc.exists() 
                        ? { id: matchDoc.id, ...matchDoc.data(), matchDate: (matchDoc.data().matchDate as Timestamp).toDate() } as Match 
                        : null;
                    
                    return { ...prediction, match };
                })
            );
            
            setPredictions(predictionsWithMatches.sort((a, b) => {
                if (!a.match || !b.match) return 0;
                return (b.match.matchDate as Date).getTime() - (a.match.matchDate as Date).getTime();
            }));

        } catch (error) {
            console.error("Ошибка при загрузке истории прогнозов:", error);
            toast({ title: "Ошибка", description: "Не удалось загрузить историю прогнозов.", variant: "destructive" });
        }
        setLoadingHistory(false);
    }

    fetchHistory();
  }, [user, toast]);

  const calculatePoints = (prediction: Prediction, match: Match) => {
    if (match.status !== 'completed' || !match.winner) return 0;
    if (prediction.pointsAwarded !== undefined) {
        return prediction.pointsAwarded;
    }
    let points = 0;
    if (prediction.predictedWinner === match.winner) {
        points += scoringSettings.winnerPoints;
    }
    if (prediction.predictedScore === match.score) {
        points += scoringSettings.scorePoints;
    }
    return points;
  };

  const { activePredictions, archivedPredictions, scoreByLeague } = useMemo(() => {
    const activePredictions: PredictionWithMatch[] = [];
    const archivedPredictions: { [seasonId: string]: PredictionWithMatch[] } = {};
    const scoreByLeague: ScoreByLeague = {};
    
    predictions.forEach(p => {
        if (!p.match) return;

        if (p.seasonId) {
            if (!archivedPredictions[p.seasonId]) {
                archivedPredictions[p.seasonId] = [];
            }
            archivedPredictions[p.seasonId].push(p);
        } else {
            activePredictions.push(p);
        }

        if (p.match.status === 'completed' && !p.seasonId) {
            const points = calculatePoints(p, p.match);
            const leagueName = p.match.leagueName || 'Без категории';
            if (!scoreByLeague[leagueName]) {
                scoreByLeague[leagueName] = 0;
            }
            scoreByLeague[leagueName] += points;
        }
    });

    return { 
        activePredictions, 
        archivedPredictions,
        scoreByLeague
    };
  }, [predictions, seasons, scoringSettings]);

  const getSeasonName = (seasonId: string) => {
    const season = seasons.find(s => s.id === seasonId);
    return season ? season.name : 'Архивный сезон';
  }


  const handleAvatarUpdate = async () => {
    if (!user) return;
    
    try {
        new URL(newAvatarUrl);
    } catch (_) {
        toast({ title: "Неверный URL", description: "Пожалуйста, введите действительный URL-адрес изображения.", variant: "destructive"});
        return;
    }

    toast({ title: "Обновление...", description: "Ваш аватар обновляется." });
    
    const userDocRef = doc(db, 'users', user.id);
    try {
        await updateDoc(userDocRef, {
            avatarUrl: newAvatarUrl
        });
        toast({ title: "Успешно!", description: "Ваш аватар обновлен." });
    } catch (error) {
        console.error("Ошибка при обновлении аватара:", error);
        toast({ title: "Ошибка обновления", description: "Не удалось обновить ваш аватар. Пожалуйста, попробуйте еще раз.", variant: 'destructive' });
    }
  };
  
    const handleUsernameUpdate = async () => {
        if (!user || !newUsername.trim()) {
            toast({ title: "Ошибка", description: "Имя пользователя не может быть пустым.", variant: "destructive" });
            return;
        }
        if (newUsername.trim() === user.username) {
            toast({ title: "Нет изменений", description: "Новое имя пользователя совпадает со старым." });
            return;
        }

        toast({ title: "Обновление...", description: "Ваше имя пользователя обновляется." });

        const userDocRef = doc(db, 'users', user.id);
        try {
            await updateDoc(userDocRef, {
                username: newUsername.trim()
            });
            toast({ title: "Успешно!", description: "Ваше имя пользователя обновлено." });
        } catch (error) {
            console.error("Ошибка при обновлении имени пользователя:", error);
            toast({ title: "Ошибка обновления", description: "Не удалось обновить ваше имя пользователя.", variant: 'destructive' });
        }
    };


  if (authLoading) {
    return <div>Загрузка профиля...</div>;
  }

  if (!user) {
    return (
        <div className="flex flex-col items-center justify-center text-center h-96">
            <h1 className="text-4xl font-headline font-bold">Вы не вошли в систему</h1>
            <p className="text-muted-foreground mt-4">Пожалуйста, войдите, чтобы просмотреть свой профиль.</p>
        </div>
    );
  }

  const renderPredictionTable = (predictionList: PredictionWithMatch[]) => (
     <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Матч</TableHead>
                <TableHead>Ваш прогноз</TableHead>
                <TableHead>Фактический результат</TableHead>
                <TableHead className="text-right">Очки</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {predictionList.map((prediction) => {
                const { id, match, predictedWinner, predictedScore } = prediction;
                if (!match) return null;
                const predictedWinnerName = predictedWinner === 'teamA' ? match.teamA : match.teamB;
                const actualWinnerName = match.winner ? (match.winner === 'teamA' ? match.teamA : match.teamB) : 'N/A';
                const points = calculatePoints(prediction, match);

                return (
                    <TableRow key={id}>
                        <TableCell>
                            <div className="font-medium">{match.teamA} vs {match.teamB}</div>
                            <div className="text-sm text-muted-foreground">{(match.matchDate as Date).toLocaleDateString()}</div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="secondary">{predictedWinnerName} ({predictedScore})</Badge>
                        </TableCell>
                        <TableCell>
                            {match.status === 'completed' ? (
                                <Badge variant="default">{actualWinnerName} ({match.score})</Badge>
                            ) : (
                                <Badge variant="outline">{match.status}</Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                                {match.status === 'completed' ? (
                                <span className={points > 0 ? "text-accent" : "text-muted-foreground"}>
                                    +{points}
                                </span>
                            ) : (
                                <span className="text-muted-foreground">-</span>
                            )}
                        </TableCell>
                    </TableRow>
                )
            })}
        </TableBody>
    </Table>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start py-8">
      <div className="md:col-span-1 space-y-8">
        <Card className="bg-card/80 backdrop-blur-sm shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
               <AlertDialog>
                <AlertDialogTrigger asChild>
                    <div className="relative group cursor-pointer">
                        <Avatar className="h-24 w-24 border-4 border-primary">
                        <AvatarImage src={user.avatarUrl} alt={user.username} className="object-cover" />
                        <AvatarFallback className="text-4xl">{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div
                            className="absolute inset-0 h-full w-full bg-black/50 text-white opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-opacity"
                        >
                            <Edit className="h-8 w-8" />
                        </div>
                    </div>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Сменить аватар</AlertDialogTitle>
                    <AlertDialogDescription>
                        Вставьте новый URL-адрес изображения.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="avatar-url" className="text-right">
                                URL изображения
                            </Label>
                            <Input 
                                id="avatar-url" 
                                value={newAvatarUrl} 
                                onChange={(e) => setNewAvatarUrl(e.target.value)}
                                className="col-span-3" 
                                placeholder="https://example.com/image.png"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={handleAvatarUpdate}>Сохранить</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex justify-center items-center gap-2">
                <CardTitle className="text-3xl font-headline">{user.username}</CardTitle>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Edit className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Сменить имя пользователя</AlertDialogTitle>
                        <AlertDialogDescription>
                            Введите новое имя пользователя.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="username" className="text-right">
                                    Имя
                                </Label>
                                <Input 
                                    id="username" 
                                    value={newUsername} 
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className="col-span-3" 
                                />
                            </div>
                        </div>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUsernameUpdate}>Сохранить</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            <CardDescription>{user.email}</CardDescription>

          </CardHeader>
          <CardContent className="mt-4">
            <div className="flex flex-col items-center space-y-4">
               <div className="flex items-center space-x-2">
                  {user.role === 'admin' ? <Shield className="h-6 w-6 text-primary" /> : <UserIcon className="h-6 w-6 text-muted-foreground" />}
                  <span className="text-lg font-medium">Роль:</span>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                  </Badge>
               </div>
               <div className="flex items-center space-x-2">
                  <span className="text-lg font-medium">Счет:</span>
                  <span className="text-2xl font-bold text-accent">{loadingHistory ? <Skeleton className="h-8 w-16" /> : user.score}</span>
               </div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-medium">Общий счет:</span>
                  <span className="text-2xl font-bold text-accent">{loadingHistory ? <Skeleton className="h-8 w-16" /> : user.allTimeScore || 0}</span>
               </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-headline flex items-center gap-2">
                  <AwardIcon className="text-accent" />
                  Достижения
                </CardTitle>
                <CardDescription>Заслуженные награды за прошлые турниры.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="space-y-4">
                    {user.awards && user.awards.length > 0 ? (
                      user.awards.map((award) => (
                        <div key={award.id} className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/10 transition-all hover:bg-primary/10">
                          <AwardBadge rank={award.rank} title={award.title} />
                          <div className="flex-1">
                            <p className="font-black text-sm leading-tight uppercase tracking-tight">{award.title}</p>
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{award.rank} МЕСТО</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground italic text-center py-4">Достижений пока нет.</p>
                    )}
                 </div>
            </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-headline flex items-center gap-2">
                  <BarChart3 />
                  Очки по лигам
                </CardTitle>
            </CardHeader>
            <CardContent>
                 {loadingHistory ? (
                    <div className="space-y-2">
                        {[...Array(2)].map((_,i) => (<Skeleton key={i} className="h-8 w-full" />))}
                    </div>
                ) : Object.keys(scoreByLeague).length > 0 ? (
                    <Table>
                        <TableBody>
                            {Object.entries(scoreByLeague).sort(([, a], [, b]) => b - a).map(([leagueName, points]) => (
                                <TableRow key={leagueName}>
                                    <TableCell className="font-medium p-2">{leagueName}</TableCell>
                                    <TableCell className="text-right font-bold text-accent p-2">{points}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <p className="text-sm text-muted-foreground">Очков пока нет.</p>
                )}
            </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2 space-y-8">
        <Card className="bg-card/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-headline">История прогнозов</CardTitle>
            </CardHeader>
            <CardContent>
                 {loadingHistory ? (
                    <div className="space-y-2">
                        {[...Array(5)].map((_,i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                ) : activePredictions.length > 0 ? (
                    renderPredictionTable(activePredictions)
                ) : (
                   <p className="text-sm text-muted-foreground text-center py-4">Вы еще не делали прогнозов.</p>
                )}
            </CardContent>
        </Card>

        {Object.keys(archivedPredictions).length > 0 && (
            <Card className="bg-card/80 backdrop-blur-sm shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center gap-2">
                        <Archive />
                        Архивные сезоны
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        {Object.entries(archivedPredictions).map(([seasonId, predictionsInSeason]) => (
                             <AccordionItem key={seasonId} value={seasonId}>
                                <AccordionTrigger>{getSeasonName(seasonId)}</AccordionTrigger>
                                <AccordionContent>
                                    {renderPredictionTable(predictionsInSeason)}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
