
'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import type { User, Prediction, Match, Season } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BarChart3, Archive, Award as AwardIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface PredictionWithMatch extends Prediction {
    match: Match | null;
}

interface ScoreByLeague {
    [leagueName: string]: number;
}

function AwardBadge({ rank, title, size = "md" }: { rank: number, title: string, size?: "sm" | "md" }) {
  const colors = {
    1: { bg: 'url(#gold-grad-h)', text: '#451a03', border: '#fde047', shadow: 'rgba(234, 179, 8, 0.5)' },
    2: { bg: 'url(#silver-grad-h)', text: '#0f172a', border: '#e2e8f0', shadow: 'rgba(148, 163, 184, 0.5)' },
    3: { bg: 'url(#bronze-grad-h)', text: '#451a03', border: '#fdba74', shadow: 'rgba(194, 65, 12, 0.5)' },
  }[rank] || { bg: 'url(#neutral-grad-h)', text: '#ffffff', border: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.5)' };

  const yearMatch = title.match(/\d{4}/);
  const year = yearMatch ? yearMatch[0] : '';
  const shortYear = year ? `'${year.slice(-2)}` : '';

  const dim = size === "sm" ? "w-10 h-10" : "w-14 h-14";

  return (
    <div className={cn("relative flex-shrink-0 select-none", dim)} style={{ filter: `drop-shadow(0 4px 6px ${colors.shadow})` }}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id="gold-grad-h" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#fef08a' }} />
            <stop offset="50%" style={{ stopColor: '#eab308' }} />
            <stop offset="100%" style={{ stopColor: '#a16207' }} />
          </linearGradient>
          <linearGradient id="silver-grad-h" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#f8fafc' }} />
            <stop offset="50%" style={{ stopColor: '#94a3b8' }} />
            <stop offset="100%" style={{ stopColor: '#475569' }} />
          </linearGradient>
          <linearGradient id="bronze-grad-h" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#ffedd5' }} />
            <stop offset="50%" style={{ stopColor: '#d97706' }} />
            <stop offset="100%" style={{ stopColor: '#7c2d12' }} />
          </linearGradient>
          <linearGradient id="neutral-grad-h" x1="0%" y1="0%" x2="100%" y2="100%">
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

export default function UserHistoryPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const [user, setUser] = useState<User | null>(null);
    const [predictions, setPredictions] = useState<PredictionWithMatch[]>([]);
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [scoringSettings, setScoringSettings] = useState({ winnerPoints: 25, scorePoints: 50 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const fetchUserData = async () => {
            setLoading(true);
            try {
                const userDocRef = doc(db, 'users', userId);
                const settingsDocRef = doc(db, 'settings', 'scoring');
                // Corrected: Predictions are in the user's subcollection
                const predictionsQuery = collection(db, 'users', userId, 'predictions');
                const seasonsQuery = query(collection(db, 'seasons'), orderBy('createdAt', 'desc'));

                const [userDoc, settingsDoc, predictionsSnapshot, seasonsSnapshot] = await Promise.all([
                    getDoc(userDocRef), 
                    getDoc(settingsDocRef),
                    getDocs(predictionsQuery),
                    getDocs(seasonsQuery)
                ]);

                if (userDoc.exists()) {
                    setUser({ id: userDoc.id, ...userDoc.data() } as User);
                }
                
                setSeasons(seasonsSnapshot.docs.map(s => ({id: s.id, ...s.data()} as Season)));

                const currentScoringSettings = settingsDoc.exists() 
                    ? settingsDoc.data() as { winnerPoints: number, scorePoints: number }
                    : { winnerPoints: 25, scorePoints: 50 };
                setScoringSettings(currentScoringSettings);
                
                const userPredictions = predictionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prediction));

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
                console.error("Ошибка при загрузке истории пользователя: ", error);
            }
            setLoading(false);
        };

        fetchUserData();
    }, [userId]);

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


    if (loading) {
        return (
            <div>
                 <div className="mb-8">
                    <Skeleton className="h-10 w-1/4" />
                </div>
                 <Card>
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-16 w-16 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-2">
                            {[...Array(3)].map((_,i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!user) {
        return (
             <div className="text-center">
                <h1 className="text-2xl font-bold">Пользователь не найден</h1>
                <Button asChild variant="link" className="mt-4">
                    <Link href="/rankings"><ArrowLeft className="mr-2 h-4 w-4" /> Назад к рейтингам</Link>

                </Button>
            </div>
        )
    }
    
    const renderPredictionTable = (predictionList: PredictionWithMatch[]) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Матч</TableHead>
                    <TableHead>Прогноз</TableHead>
                    <TableHead>Результат</TableHead>
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
        <div>
            <div className="mb-8">
                 <Button asChild variant="outline" size="sm">
                    <Link href="/rankings"><ArrowLeft className="mr-2 h-4 w-4" /> Назад к рейтингам</Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                <div className="md:col-span-1 space-y-8">
                    <Card className="bg-card/80 backdrop-blur-sm">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 border-2 border-primary">
                                    <AvatarImage src={user.avatarUrl} alt={user.username} className="object-cover" />
                                    <AvatarFallback className="text-2xl">{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle className="text-3xl font-headline">{user.username}</CardTitle>
                                    <CardDescription>Счет сезона: <span className="font-bold text-accent">{user.score}</span></CardDescription>
                                    <CardDescription>Общий счет: <span className="font-bold text-accent">{user.allTimeScore || 0}</span></CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    <Card className="bg-card/80 backdrop-blur-sm shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-2xl font-headline flex items-center gap-2">
                                <AwardIcon className="text-accent" />
                                Достижения
                            </CardTitle>
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
                                Счет по лигам (текущий сезон)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {Object.keys(scoreByLeague).length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Лига</TableHead>
                                            <TableHead className="text-right">Очки</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(scoreByLeague).sort(([, a], [, b]) => b - a).map(([leagueName, points]) => (
                                            <TableRow key={leagueName}>
                                                <TableCell className="font-medium">{leagueName}</TableCell>
                                                <TableCell className="text-right font-bold text-accent">{points}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-sm text-muted-foreground">Очков в текущем сезоне пока нет.</p>
                            )}
                        </CardContent>
                    </Card>

                </div>
                 <div className="md:col-span-2 space-y-8">
                    <Card className="bg-card/80 backdrop-blur-sm">
                        <CardHeader>
                             <CardTitle>История прогнозов (текущий сезон)</CardTitle>
                        </CardHeader>
                        <CardContent>
                           {loading ? (
                                <Skeleton className="h-24 w-full" />
                           ) : activePredictions.length > 0 ? (
                               renderPredictionTable(activePredictions)
                           ): (
                                <p className="text-sm text-muted-foreground text-center py-4">Нет прогнозов в текущем сезоне.</p>
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
        </div>
    );
}
