
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, ArrowRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface AllTimeRanking {
    rank: number;
    user: User;
}

export default function AllTimeRankingsPage() {
    const [rankings, setRankings] = useState<AllTimeRanking[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchRankingsData = async () => {
            setLoading(true);
            try {
                const usersQuery = query(collection(db, 'users'), orderBy('allTimeScore', 'desc'));
                const usersSnapshot = await getDocs(usersQuery);

                const users: User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

                const rankingsData: AllTimeRanking[] = users.map((user, index) => ({
                    rank: index + 1,
                    user,
                }));

                setRankings(rankingsData);

            } catch (error) {
                console.error("Ошибка при загрузке общего рейтинга: ", error);
                toast({ title: "Ошибка", description: "Не удалось загрузить данные общего рейтинга.", variant: "destructive"});
            }
            setLoading(false);
        };

        fetchRankingsData();
    }, [toast]);

    const getRankColor = (rank: number) => {
        if (rank === 1) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
        if (rank === 2) return "bg-gray-400/20 text-gray-300 border-gray-400/30";
        if (rank === 3) return "bg-orange-600/20 text-orange-500 border-orange-600/30";
        return "bg-secondary text-secondary-foreground border-transparent";
    };
    
    if (loading) {
        return (
             <div>
                <h1 className="text-4xl font-headline font-bold mb-2">Общий рейтинг</h1>
                <p className="text-muted-foreground mb-8">Таблица лидеров легенд. Очки никогда не сбрасываются.</p>
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
            <div className="mb-4">
                <h1 className="text-4xl font-headline font-bold mb-2">Общий рейтинг</h1>
                <p className="text-muted-foreground">Таблица лидеров легенд. Очки никогда не сбрасываются.</p>
            </div>

            <Card className="bg-card/80 backdrop-blur-sm">
                 <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Ранг</TableHead>
                                <TableHead>Игрок</TableHead>
                                <TableHead className="text-right">Общий счет</TableHead>
                                <TableHead className="w-[150px] text-center">История</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rankings.map(({ rank, user }) => (
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
                                    <TableCell className="text-right font-bold text-xl text-primary">{user.allTimeScore || 0}</TableCell>
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

