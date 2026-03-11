
'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Match, League } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Trophy } from 'lucide-react';
import { WarningLink } from '@/hooks/use-navigation-warning';
import { cn } from '@/lib/utils';

const getStatusVariant = (status: Match['status']) => {
    switch (status) {
        case 'completed':
            return 'secondary';
        case 'live':
            return 'destructive';
        case 'upcoming':
        default:
            return 'default';
    }
};

export default function LeagueMatchesPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = use(params);
  const [matches, setMatches] = useState<Match[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [selectedYear, setSelectedYear] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
        if (leagueDoc.exists()) {
          setLeague({ id: leagueDoc.id, ...leagueDoc.data() } as League);
        }

        const matchesQuery = query(
          collection(db, 'matches'), 
          where('leagueId', '==', leagueId)
        );
        const matchesSnapshot = await getDocs(matchesQuery);

        const fetchedMatches = matchesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                matchDate: (data.matchDate as Timestamp).toDate(),
            } as Match;
        });

        setMatches(fetchedMatches.sort((a, b) => (b.matchDate as Date).getTime() - (a.matchDate as Date).getTime()));
      } catch (error) {
        console.error("Ошибка при загрузке данных: ", error);
        toast({ title: 'Ошибка', description: 'Не удалось загрузить данные лиги или матчи.', variant: 'destructive' });
      }
      setLoading(false);
    };

    fetchData();
  }, [leagueId, toast]);

  const years = useMemo(() => {
    const yearsSet = new Set<string>();
    matches.forEach(match => {
      const year = (match.matchDate as Date).getFullYear().toString();
      yearsSet.add(year);
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      if (selectedYear === 'all') return true;
      return (match.matchDate as Date).getFullYear().toString() === selectedYear;
    });
  }, [matches, selectedYear]);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-10 w-32 mb-8" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold">Лига не найдена</h1>
        <Button asChild variant="link" className="mt-4">
          <WarningLink href="/matches"><ArrowLeft className="mr-2 h-4 w-4" /> Назад к списку лиг</WarningLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10">
          <WarningLink href="/matches">
            <ArrowLeft className="mr-2 h-4 w-4" /> Назад к списку лиг
          </WarningLink>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 bg-card/50 p-6 rounded-2xl border border-primary/10 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 relative rounded-full shadow-xl border border-white/30 overflow-hidden">
            <div className="absolute inset-4">
              {league.logoUrl ? (
                <Image src={league.logoUrl} alt={league.name} fill className="object-contain" />
              ) : (
                <Trophy className="h-full w-full text-primary/40" />
              )}
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-headline font-bold text-primary">{league.name}</h1>
            <p className="text-muted-foreground">Расписание и результаты турниров</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Calendar className="h-5 w-5 text-accent" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full md:w-[140px] bg-background border-primary/20">
              <SelectValue placeholder="Год" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все годы</SelectItem>
              {years.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {filteredMatches.length === 0 ? (
          <Card className="bg-card/80 backdrop-blur-sm shadow-lg text-center p-12 border-dashed">
            <CardTitle>Матчи не найдены</CardTitle>
            <CardDescription className="mt-2">В этом году матчей данной лиги пока не зафиксировано.</CardDescription>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredMatches.map((match) => (
              <Card key={match.id} className="group overflow-hidden bg-card/80 backdrop-blur-sm shadow-lg border-primary/5 hover:border-primary/20 transition-all duration-300">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap justify-between items-center gap-4 mb-2">
                    <Badge variant={getStatusVariant(match.status)} className="font-bold uppercase tracking-wider px-3">
                      {match.status === 'live' ? 'В ПРЯМОМ ЭФИРЕ' : match.status === 'completed' ? 'ЗАВЕРШЕН' : 'ПРЕДСТОЯЩИЙ'}
                    </Badge>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="border-accent/50 text-accent font-semibold">{match.series}</Badge>
                      <span className="text-sm text-muted-foreground font-medium">
                        {(match.matchDate as Date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 py-4">
                    <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left flex-1 justify-end">
                      <span className="text-xl md:text-2xl font-bold font-headline order-2 md:order-1">{match.teamAShortName || match.teamA}</span>
                      <div className="w-16 h-16 relative order-1 md:order-2 rounded-full shadow-md border border-white/20 group-hover:scale-105 transition-transform overflow-hidden">
                        <div className="absolute inset-4">
                          <Image src={match.teamALogo} alt={match.teamA} fill className={cn("object-contain", match.teamAHasDarkLogo && "drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]")} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 shrink-0">
                      {match.status === 'completed' && match.score ? (
                        <div className="text-4xl md:text-5xl font-black text-accent tracking-tighter bg-accent/10 px-6 py-2 rounded-xl">
                          {match.score}
                        </div>
                      ) : (
                        <div className="text-2xl font-black text-primary/20 tracking-widest italic">
                          VS
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-right flex-1 justify-start">
                      <div className="w-16 h-16 relative rounded-full shadow-md border border-white/20 group-hover:scale-105 transition-transform overflow-hidden">
                        <div className="absolute inset-4">
                          <Image src={match.teamBLogo} alt={match.teamB} fill className={cn("object-contain", match.teamBHasDarkLogo && "drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]")} />
                        </div>
                      </div>
                      <span className="text-xl md:text-2xl font-bold font-headline">{match.teamBShortName || match.teamB}</span>
                    </div>
                  </div>
                </CardContent>
                <div className={`h-1.5 w-full ${match.status === 'live' ? 'bg-destructive animate-pulse' : 'bg-primary/10'}`} />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
