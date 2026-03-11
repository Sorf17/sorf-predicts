'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { League } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { WarningLink } from '@/hooks/use-navigation-warning';
import { Trophy } from 'lucide-react';

export default function MatchesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchLeagues = async () => {
      setLoading(true);
      try {
        const leaguesQuery = query(collection(db, 'leagues'), orderBy('name'));
        const leaguesSnapshot = await getDocs(leaguesQuery);
        const fetchedLeagues = leaguesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as League));
        setLeagues(fetchedLeagues);
      } catch (error) {
        console.error("Ошибка при загрузке лиг: ", error);
        toast({ title: 'Ошибка', description: 'Не удалось загрузить лиги.', variant: 'destructive' });
      }
      setLoading(false);
    };

    fetchLeagues();
  }, [toast]);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-4xl font-headline font-bold mb-2">Матчи</h1>
        <p className="text-muted-foreground mb-8">Выберите лигу, чтобы просмотреть расписание и результаты.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-headline font-bold mb-2">Матчи</h1>
      <p className="text-muted-foreground mb-8">Выберите лигу, чтобы просмотреть расписание и результаты.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {leagues.length === 0 ? (
          <div className="col-span-full text-center py-20">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-bold">Лиги не найдены</h3>
            <p className="text-muted-foreground">В данный момент нет доступных лиг.</p>
          </div>
        ) : (
          leagues.map((league) => (
            <WarningLink key={league.id} href={`/matches/${league.id}`}>
              <Card className="group relative overflow-hidden h-full cursor-pointer border-2 border-transparent hover:border-accent transition-all duration-300 bg-card/80 backdrop-blur-sm shadow-md hover:shadow-accent/20">
                <CardHeader className="flex flex-col items-center justify-center pt-8">
                  <div className="w-28 h-28 relative mb-4 transition-transform duration-300 group-hover:scale-110 flex items-center justify-center rounded-2xl p-4 shadow-xl border border-white/20">
                    {league.logoUrl ? (
                      <div className="relative w-full h-full">
                         <Image 
                          src={league.logoUrl} 
                          alt={league.name} 
                          fill 
                          className="object-contain drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]"
                          data-ai-hint="League Logo"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-primary/10 rounded-full flex items-center justify-center">
                        <Trophy className="h-10 w-10 text-primary" />
                      </div>
                    )}
                  </div>
                  <CardTitle className="text-xl font-headline text-center group-hover:text-accent transition-colors">
                    {league.name === 'Worlds 2025' ? 'Worlds' : league.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center pb-8">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    Посмотреть матчи
                  </span>
                </CardContent>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-accent transition-all duration-300 group-hover:w-full" />
              </Card>
            </WarningLink>
          ))
        )}
      </div>
    </div>
  );
}
