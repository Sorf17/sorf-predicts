
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, ArrowRight, History } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc, collectionGroup } from 'firebase/firestore';
import type { User, Ranking, Prediction, Match, League } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface RankingWithLeagueScores extends Omit<Ranking, 'predictions'> {
    leagueScores?: { [leagueId: string]: number };
}

export default function RankingsPage() {
    const [rankings, setRankings] = useState<RankingWithLeagueScores[]>([]);
    const [leagues, setLeagues] = useState<League[]>([]);
    const [selectedLeague, setSelectedLeague] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    
    const [scoringSettings, setScoringSettings] = useState({ winnerPoints: 25, scorePoints: 50 });


    useEffect(() => {
        const fetchRankingsData = async () => {
            setLoading(true);
            try {
                // Fetch all necessary data in parallel
                const usersQuery = query(collection(db, 'users'));
                const leaguesQuery = query(collection(db, 'leagues'));
                // Corrected: Use collectionGroup to fetch predictions from all user subcollections
                const predictionsQuery = query(collectionGroup(db, 'predictions'), where('seasonId', '==', null));
                const matchesQuery = query(collection(db, 'matches'), where('status', '==', 'completed'));
                const settingsDocRef = doc(db, 'settings', 'scoring');
                
                const [usersSnapshot, leaguesSnapshot, predictionsSnapshot, matchesSnapshot, settingsDoc] = await Promise.all([
                    getDocs(usersQuery),
                    getDocs(leaguesQuery),
                    getDocs(predictionsQuery),
                    getDocs(matchesQuery),
                    getDoc(settingsDocRef)
                ]);

                if (settingsDoc.exists()) {
                    setScoringSettings(settingsDoc.data() as { winnerPoints: number, scorePoints: number });
                }
                const currentScoringSettings = settingsDoc.exists()
                    ? settingsDoc.data() as { winnerPoints: number, scorePoints: number }
                    : { winnerPoints: 25, scorePoints: 50 };


                const users: User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
                const fetchedLeagues: League[] = leaguesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as League));
                const allPredictions: Prediction[] = predictionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prediction));
                const allMatches: Match[] = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
                
                const matchesById = new Map(allMatches.map(m => [m.id, m]));

                const leagueScoresByUser: { [userId: string]: { [leagueId: string]: number } } = {};

                allPredictions.forEach(prediction => {
                    const match = matchesById.get(prediction.matchId);
                    if (!match || match.status !== 'completed' || !match.winner) return;

                    let points = 0;
                    if (prediction.predictedWinner === match.winner) {
                        points += currentScoringSettings.winnerPoints;
                    }
                    if (prediction.predictedScore === match.score) {
                        points += currentScoringSettings.scorePoints;
                    }

                    if (points > 0) {
                        if (!leagueScoresByUser[prediction.userId]) {
                            leagueScoresByUser[prediction.userId] = {};
                        }
                        if (!leagueScoresByUser[prediction.userId][match.leagueId]) {
                            leagueScoresByUser[prediction.userId][match.leagueId] = 0;
                        }
                        leagueScoresByUser[prediction.userId][match.leagueId] += points;
                    }
                });

                const rankingsData: RankingWithLeagueScores[] = users.map(user => ({
                    rank: 0, // Rank will be set after sorting
                    user,
                    leagueScores: leagueScoresByUser[user.id] || {}
                }));

                setRankings(rankingsData);
                setLeagues(fetchedLeagues);

            } catch (error) {
                console.error("Ошибка при загрузке рейтингов: ", error);
                toast({ title: "Ошибка", description: "Не удалось загрузить данные рейтинга.", variant: "destructive"});
            }
            setLoading(false);
        };

        fetchRankingsData();
    }, [toast]);

    const sortedRankings = useMemo(() => {
        return rankings
            .map(r => {
                let displayScore = r.user.score;
                if (selectedLeague !== 'all') {
                    displayScore = r.leagueScores?.[selectedLeague] || 0;
                }
                return { ...r, displayScore };
            })
            .filter(r => selectedLeague === 'all' || r.displayScore > 0)
            .sort((a, b) => b.displayScore - a.displayScore)
            .map((r, index) => ({ ...r, rank: index + 1 }));
    }, [rankings, selectedLeague]);


    const getRankColor = (rank: number) => {
        if (rank === 1) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
        if (rank === 2) return "bg-gray-400/20 text-gray-300 border-gray-400/30";
        if (rank === 3) return "bg-orange-600/20 text-orange-500 border-orange-600/30";
        return "bg-secondary text-secondary-foreground border-transparent";
    };
    
    if (loading) {
        return (
             <div>
                <h1 className="text-4xl font-headline font-bold mb-2">Рейтинги</h1>
                <p className="text-muted-foreground mb-8">Узнайте, кто лидирует в таблице прогнозов.</p>
                <Card className="bg-card/80 backdrop-blur-sm p-4">
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-4 w-1/4" />
                                </div>
                                <Skeleton className="h-8 w-24" />
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-4xl font-headline font-bold mb-2">Рейтинги</h1>
                    <p className="text-muted-foreground">Узнайте, кто лидирует в таблице прогнозов текущего сезона.</p>
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
            
            <div className="mb-8">
                <Button asChild variant="outline">
                    <Link href="/all-time-rankings">
                        <History className="mr-2 h-4 w-4" />
                        Посмотреть рейтинг за всё время
                    </Link>
                </Button>
            </div>

            <Card className="bg-card/80 backdrop-blur-sm">
                 <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Ранг</TableHead>
                                <TableHead>Игрок</TableHead>
                                <TableHead className="text-right">Счет</TableHead>
                                <TableHead className="w-[150px] text-center">История</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedRankings.map(({ rank, user, displayScore }) => (
                                <TableRow key={user.id} className={rank <= 3 ? `bg-primary/${20 - rank * 5}` : ''}>
                                    <TableCell>
                                        <Badge variant="outline" className={`text-lg font-bold w-12 h-12 flex items-center justify-center rounded-full ${getRankColor(rank)}`}>
                                            {rank === 1 ? <Crown className="w-6 h-6" /> : rank}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={user.avatarUrl} alt={user.username} />
                                                <AvatarFallback>{user.username ? user.username.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{user.username}</span>
                                            {user.role === 'admin' && <Badge variant="secondary">Админ</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-xl text-primary">{displayScore}</TableCell>
                                    <TableCell className="text-center">
                                    <Button asChild variant="ghost" size="sm">
                                            <Link href={`/rankings/${user.id}`}>
                                                Смотреть историю <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                    </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
