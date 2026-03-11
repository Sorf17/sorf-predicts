
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Match, Prediction } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, Timestamp, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Swords, LayoutGrid } from 'lucide-react';
import { isEqual } from 'lodash';
import { useNavigationWarning } from '@/hooks/use-navigation-warning';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface PredictionState {
  [matchId: string]: {
    winner: 'teamA' | 'teamB' | null;
    score: string | null;
  };
}

const getScoreOptions = (series: 'Bo1' | 'Bo3' | 'Bo5') => {
  switch (series) {
    case 'Bo1':
      return ['1-0', '0-1'];
    case 'Bo3':
      return ['2-0', '0-2', '2-1', '1-2'];
    case 'Bo5':
      return ['3-0', '0-3', '3-1', '1-3', '3-2', '2-3'];
    default:
      return [];
  }
};

function DynamicTeamName({ full, short, className }: { full: string; short?: string; className?: string }) {
  const [name, setName] = useState(full);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const checkOverflow = () => {
      if (ref.current && short && short !== full) {
        setName(full);
        setTimeout(() => {
          if (ref.current && ref.current.scrollWidth > ref.current.clientWidth) {
            setName(short);
          }
        }, 0);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [full, short]);

  return (
    <span ref={ref} className={cn("block truncate", className)}>
      {name}
    </span>
  );
}

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<PredictionState>({});
  const [savedPredictions, setSavedPredictions] = useState<PredictionState>({});
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLeague, setActiveLeague] = useState<string>('all');
  const { user } = useAuth();
  const { toast } = useToast();

  const haveUnsavedChanges = useMemo(() => {
    return !isEqual(predictions, savedPredictions);
  }, [predictions, savedPredictions]);
  
  useNavigationWarning(haveUnsavedChanges);

  const leagues = useMemo(() => {
    const leaguesMap = new Map<string, { count: number; predicted: number }>();
    upcomingMatches.forEach(m => {
      const name = m.leagueName || 'Без категории';
      const stats = leaguesMap.get(name) || { count: 0, predicted: 0 };
      stats.count++;
      if (predictions[m.id]?.score) stats.predicted++;
      leaguesMap.set(name, stats);
    });
    return Array.from(leaguesMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [upcomingMatches, predictions]);

  const filteredMatches = useMemo(() => {
    const sorted = activeLeague === 'all' 
      ? [...upcomingMatches] 
      : upcomingMatches.filter(m => (m.leagueName || 'Без категории') === activeLeague);
    
    return sorted.sort((a, b) => {
      const dateA = a.matchDate instanceof Timestamp ? a.matchDate.toDate() : a.matchDate;
      const dateB = b.matchDate instanceof Timestamp ? b.matchDate.toDate() : b.matchDate;
      return (dateA as Date).getTime() - (dateB as Date).getTime();
    });
  }, [upcomingMatches, activeLeague]);

  useEffect(() => {
    const fetchMatchesAndPredictions = async () => {
      if (!user) {
          setLoading(false);
          return;
      }
      setLoading(true);
      try {
        const matchesQuery = query(
          collection(db, 'matches'), 
          where('status', '==', 'upcoming')
        );
        const matchesSnapshot = await getDocs(matchesQuery);

        const now = new Date();
        const batch = writeBatch(db);
        const freshMatches: Match[] = [];
        
        matchesSnapshot.docs.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const match = {
                id: docSnapshot.id,
                ...data,
                matchDate: (data.matchDate as Timestamp).toDate(),
            } as Match;

            if ((match.matchDate as Date) <= now && !match.adminOverride) {
                const matchRef = doc(db, 'matches', match.id);
                batch.update(matchRef, { status: 'live' });
            } else {
                freshMatches.push(match);
            }
        });
        
        await batch.commit();
        freshMatches.sort((a, b) => (a.matchDate as Date).getTime() - (b.matchDate as Date).getTime());
        setUpcomingMatches(freshMatches);

        if (user && freshMatches.length > 0) {
            const matchIds = freshMatches.map(m => m.id);
            const predictionsQuery = query(
                collection(db, 'users', user.id, 'predictions'), 
                where('matchId', 'in', matchIds)
            );
            const predictionsSnapshot = await getDocs(predictionsQuery);
            const existingPredictions = predictionsSnapshot.docs.reduce((acc, doc) => {
                const p = doc.data() as Prediction;
                acc[p.matchId] = { winner: p.predictedWinner, score: p.predictedScore };
                return acc;
            }, {} as PredictionState);
            setPredictions(existingPredictions);
            setSavedPredictions(existingPredictions);
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных: ", error);
        toast({ title: 'Ошибка', description: 'Не удалось загрузить матчи или прогнозы.', variant: 'destructive' });
      }
      setLoading(false);
    };

    fetchMatchesAndPredictions();
  }, [toast, user]);

  const handleScoreSelect = (matchId: string, score: string) => {
    const [scoreA, scoreB] = score.split('-').map(Number);
    const winner = scoreA > scoreB ? 'teamA' : 'teamB';
    setPredictions(prev => ({
      ...prev,
      [matchId]: { score, winner }
    }));
  };

  const handleSubmit = () => {
    if (!user) {
        toast({ title: 'Ошибка', description: 'Вы должны войти в систему.', variant: 'destructive' });
        return;
    }
    
    const batch = writeBatch(db);
    const predictionsToSave : PredictionState = {};

    for (const matchId in predictions) {
        const prediction = predictions[matchId];
        if (prediction.winner && prediction.score) {
            // Correct subcollection path per rules: /users/{userId}/predictions/{matchId}
            const predictionRef = doc(db, 'users', user.id, 'predictions', matchId);
            const predictionData = {
                userId: user.id,
                matchId: matchId,
                predictedWinner: prediction.winner,
                predictedScore: prediction.score,
                pointsAwarded: 0,
            };
            batch.set(predictionRef, predictionData, { merge: true });
            predictionsToSave[matchId] = prediction;
        }
    }
    
    batch.commit()
      .then(() => {
        setSavedPredictions(prev => ({ ...prev, ...predictionsToSave }));
        toast({ title: 'Успешно', description: 'Ваши прогнозы сохранены!' });
      })
      .catch(async (error) => {
        console.error("Ошибка при сохранении прогнозов:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `users/${user.id}/predictions`,
          operation: 'write',
          requestResourceData: predictionsToSave
        }));
        toast({ title: 'Ошибка', description: 'Не удалось сохранить прогнозы.', variant: 'destructive' });
      });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1 space-y-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
          <div className="md:col-span-3 space-y-6">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  const totalPossible = upcomingMatches.length;
  const totalPredicted = Object.keys(predictions).filter(id => upcomingMatches.some(m => m.id === id)).length;
  const progressPercent = totalPossible > 0 ? (totalPredicted / totalPossible) * 100 : 0;

  return (
    <div className="container mx-auto pb-24">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2 text-primary">Ваши прогнозы</h1>
          <p className="text-muted-foreground">Выбирайте победителей и счет матчей. Прогнозы можно менять до начала игры.</p>
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-primary/10 rounded-xl p-4 flex items-center gap-6 shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs uppercase font-black text-muted-foreground tracking-widest">Общий прогресс</span>
            <span className="text-2xl font-black text-primary font-headline">{totalPredicted} / {totalPossible}</span>
          </div>
          <div className="w-24 h-2 bg-primary/10 rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1 space-y-2">
          <div className="bg-card/80 backdrop-blur-sm border border-primary/10 rounded-xl p-2 shadow-sm">
            <Button 
              variant={activeLeague === 'all' ? 'default' : 'ghost'} 
              className="w-full justify-start font-bold mb-1"
              onClick={() => setActiveLeague('all')}
            >
              <LayoutGrid className="mr-2 h-4 w-4" /> Все лиги
            </Button>
            <div className="h-px bg-primary/10 my-2 mx-2" />
            <ScrollArea className="h-[400px]">
              {leagues.map(([name, stats]) => (
                <Button 
                  key={name}
                  variant={activeLeague === name ? 'secondary' : 'ghost'} 
                  className={cn(
                    "w-full justify-between font-medium group transition-all",
                    activeLeague === name ? "bg-primary/10 text-primary border-r-4 border-primary" : ""
                  )}
                  onClick={() => setActiveLeague(name)}
                >
                  <span className="truncate mr-2">{name}</span>
                  <Badge variant={stats.predicted === stats.count ? "default" : "outline"} className="shrink-0 text-[10px]">
                    {stats.predicted}/{stats.count}
                  </Badge>
                </Button>
              ))}
            </ScrollArea>
          </div>
        </div>

        <div className="md:col-span-3 space-y-6">
          {filteredMatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card/30 border-2 border-dashed border-primary/10 rounded-2xl">
              <Swords className="h-12 w-12 text-primary/20 mb-4" />
              <h3 className="text-xl font-bold">Нет матчей</h3>
              <p className="text-muted-foreground">В этой категории пока нет доступных игр для прогноза.</p>
            </div>
          ) : (
            filteredMatches.map((match) => {
              const currentPred = predictions[match.id];
              const isSaved = savedPredictions[match.id]?.score === currentPred?.score;
              const options = getScoreOptions(match.series);

              return (
                <Card key={match.id} className={cn(
                  "overflow-hidden transition-all border-l-4",
                  currentPred?.score ? (isSaved ? "border-l-green-500" : "border-l-accent") : "border-l-primary/20"
                )}>
                  <CardHeader className="pb-2 bg-primary/5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-black bg-background">{match.series}</Badge>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          {(match.matchDate as Date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {currentPred?.score && isSaved && (
                        <div className="flex items-center gap-1 text-green-500 text-[10px] font-black uppercase">
                          <CheckCircle className="h-3 w-3" /> Сохранено
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                      <div className="flex items-center gap-4 flex-1 justify-end w-full">
                        <DynamicTeamName 
                          full={match.teamA} 
                          short={match.teamAShortName} 
                          className="text-xl font-black font-headline text-right max-w-[150px]" 
                        />
                        <div className="w-16 h-16 relative rounded-full border border-white/20 shadow-md overflow-hidden shrink-0">
                          <div className="absolute inset-2.5">
                            <Image 
                              src={match.teamALogo} 
                              alt={match.teamA} 
                              fill 
                              className={cn("object-contain", match.teamAHasDarkLogo && "drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]")} 
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-4 min-w-[280px]">
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <div className="grid gap-2">
                             {options.filter((_, i) => i % 2 === 0).map((score) => {
                               const isSelected = currentPred?.score === score;
                               return (
                                 <Button
                                   key={score}
                                   variant={isSelected ? "default" : "outline"}
                                   size="sm"
                                   onClick={() => handleScoreSelect(match.id, score)}
                                   className={cn(
                                     "h-12 text-lg font-black transition-all border-2",
                                     isSelected 
                                       ? "ring-2 ring-primary ring-offset-2 scale-105 shadow-lg" 
                                       : "hover:border-primary/40 hover:bg-primary/5"
                                   )}
                                 >
                                   {score}
                                 </Button>
                               );
                             })}
                          </div>
                          <div className="grid gap-2">
                             {options.filter((_, i) => i % 2 !== 0).map((score) => {
                               const isSelected = currentPred?.score === score;
                               return (
                                 <Button
                                   key={score}
                                   variant={isSelected ? "default" : "outline"}
                                   size="sm"
                                   onClick={() => handleScoreSelect(match.id, score)}
                                   className={cn(
                                     "h-12 text-lg font-black transition-all border-2",
                                     isSelected 
                                       ? "ring-2 ring-primary ring-offset-2 scale-105 shadow-lg" 
                                       : "hover:border-primary/40 hover:bg-primary/5"
                                   )}
                                 >
                                   {score}
                                 </Button>
                               );
                             })}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full px-1">
                           <span className="text-[10px] font-black uppercase text-primary tracking-tight text-center truncate">
                            {match.teamAShortName || match.teamA}
                           </span>
                           <span className="text-[10px] font-black uppercase text-accent tracking-tight text-center truncate">
                            {match.teamBShortName || match.teamB}
                           </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-1 justify-start w-full">
                        <div className="w-16 h-16 relative rounded-full border border-white/20 shadow-md overflow-hidden shrink-0">
                           <div className="absolute inset-2.5">
                            <Image 
                              src={match.teamBLogo} 
                              alt={match.teamB} 
                              fill 
                              className={cn("object-contain", match.teamBHasDarkLogo && "drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]")} 
                            />
                          </div>
                        </div>
                        <DynamicTeamName 
                          full={match.teamB} 
                          short={match.teamBShortName} 
                          className="text-xl font-black font-headline text-left max-w-[150px]" 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-primary/20 p-4 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {haveUnsavedChanges ? (
              <div className="flex items-center gap-2 text-accent animate-pulse">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm font-black uppercase tracking-wider hidden sm:inline">Есть несохраненные изменения</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-black uppercase tracking-wider hidden sm:inline">Все прогнозы сохранены</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-[10px] uppercase font-black text-muted-foreground">Прогресс раздела</span>
              <span className="text-sm font-bold">{filteredMatches.filter(m => predictions[m.id]?.score).length} / {filteredMatches.length}</span>
            </div>
            <Button 
              size="lg" 
              onClick={handleSubmit} 
              disabled={!user || !haveUnsavedChanges}
              className={cn(
                "px-10 font-black uppercase tracking-widest transition-all",
                haveUnsavedChanges ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg" : ""
              )}
            >
              {haveUnsavedChanges ? "Сохранить всё" : "Сохранено"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
