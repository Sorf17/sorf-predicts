
'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp, collection, getDocs } from 'firebase/firestore';
import type { Season, SeasonRanking, User, League } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Crown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface SeasonRankingWithAvatar extends SeasonRanking {
    avatarUrl?: string;
    displayScore?: number;
}

export default function SeasonLeaderboardPage({ params }: { params: Promise<{ seasonId: string }> }) {
    const { seasonId } = use(params);
    const [season, setSeason] = useState<Omit<Season, 'rankings'> & { rankings: SeasonRankingWithAvatar[] } | null>(null);
    const [leagues, setLeagues] = useState<League[]>([]);
    const [selectedLeague, setSelectedLeague] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!seasonId) return;

        const fetchSeasonData = async () => {
            setLoading(true);
            try {
                const seasonDocRef = doc(db, 'seasons', seasonId);
                const leaguesQuery = collection(db, 'leagues');

                const [seasonDoc, leaguesSnapshot] = await Promise.all([
                  getDoc(seasonDocRef),
                  getDocs(leaguesQuery)
                ]);

                if (seasonDoc.exists()) {
                    const seasonData = seasonDoc.data() as Season;
                    
                    const rankingsWithAvatars = await Promise.all(
                        seasonData.rankings.map(async (ranking) => {
                            const userDocRef = doc(db, 'users', ranking.userId);
                            const userDoc = await getDoc(userDocRef);
                            const avatarUrl = userDoc.exists() ? (userDoc.data() as User).avatarUrl : undefined;
                            return { ...ranking, avatarUrl };
                        })
                    );

                    setSeason({ 
                        id: seasonDoc.id, 
                        name: seasonData.name,
                        createdAt: seasonData.createdAt,
                        rankings: rankingsWithAvatars
                    });
                }
                setLeagues(leaguesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as League)));
            } catch (error) {
                console.error("Ошибка при загрузке данных сезона: ", error);
            }
            setLoading(false);
        };

        fetchSeasonData();
    }, [seasonId]);

     const sortedRankings = useMemo(() => {
        if (!season) return [];
        return season.rankings
            .map(r => {
                let displayScore = r.score;
                if (selectedLeague !== 'all' && r.leagueScores) {
                    displayScore = r.leagueScores[selectedLeague] || 0;
                }
                return { ...r, displayScore };
            })
            .filter(r => selectedLeague === 'all' || r.displayScore > 0)
            .sort((a, b) => b.displayScore - a.displayScore)
            .map((r, index) => ({ ...r, rank: index + 1 }));
    }, [season, selectedLeague]);

    const getRankColor = (rank: number) => {
        if (rank === 1) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
        if (rank === 2) return "bg-gray-400/20 text-gray-300 border-gray-400/30";
        if (rank === 3) return "bg-orange-600/20 text-orange-500 border-orange-600/30";
        return "bg-secondary text-secondary-foreground border-transparent";
    };

    if (loading) {
        return (
            <div>
                <Skeleton className="h-10 w-1/4 mb-8" />
                <Card>
                    <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <Skeleton className="h-6 flex-1" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!season) {
        return (
            <div className="text-center">
                <h1 className="text-2xl font-bold">Сезон не найден</h1>
                <Button asChild variant="link" className="mt-4">
                    <Link href="/seasons"><ArrowLeft className="mr-2 h-4 w-4" /> Назад ко всем сезонам</Link>
                </Button>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8">
                <Button asChild variant="outline" size="sm">
                    <Link href="/seasons"><ArrowLeft className="mr-2 h-4 w-4" /> Назад ко всем сезонам</Link>
                </Button>
            </div>
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-4xl font-headline">{season.name}</CardTitle>
                            <CardDescription>
                                Таблица лидеров по состоянию на {(season.createdAt as Timestamp).toDate().toLocaleDateString()}
                            </CardDescription>
                        </div>
                         <div className="w-full max-w-xs">
                            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Фильтр по лиге" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все лиги</SelectItem>
                                    {leagues.map(league => (
                                        <SelectItem key={league.id} value={league.id}>{league.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Ранг</TableHead>
                                <TableHead>Игрок</TableHead>
                                <TableHead className="text-right">Итоговый счет</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedRankings.map((player) => (
                                <TableRow key={player.userId} className={player.rank <= 3 ? `bg-primary/${20 - player.rank * 5}` : ''}>
                                    <TableCell>
                                        <Badge variant="outline" className={`text-lg font-bold w-12 h-12 flex items-center justify-center rounded-full ${getRankColor(player.rank)}`}>
                                            {player.rank === 1 ? <Crown className="w-6 h-6" /> : player.rank}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={player.avatarUrl} alt={player.username} />
                                                <AvatarFallback>{player.username ? player.username.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{player.username}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-xl text-primary">{player.displayScore}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

