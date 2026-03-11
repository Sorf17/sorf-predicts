
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import type { Season } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Calendar } from 'lucide-react';

export default function SeasonsPage() {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSeasons = async () => {
            setLoading(true);
            try {
                const seasonsQuery = query(collection(db, 'seasons'), orderBy('createdAt', 'desc'));
                const seasonsSnapshot = await getDocs(seasonsQuery);
                const seasonsData = seasonsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Season));
                setSeasons(seasonsData);
            } catch (error) {
                console.error("Ошибка при загрузке сезонов: ", error);
            }
            setLoading(false);
        };

        fetchSeasons();
    }, []);

    if (loading) {
        return (
            <div>
                <h1 className="text-4xl font-headline font-bold mb-2">Сезоны</h1>
                <p className="text-muted-foreground mb-8">Просматривайте таблицы лидеров прошлых сезонов.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </CardHeader>
                            <CardContent>
                                 <Skeleton className="h-10 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-4xl font-headline font-bold mb-2">Сезоны</h1>
            <p className="text-muted-foreground mb-8">Просматривайте таблицы лидеров прошлых сезонов.</p>

            {seasons.length === 0 ? (
                 <Card className="bg-card/80 backdrop-blur-sm shadow-lg text-center p-8">
                    <CardTitle>Нет архивных сезонов</CardTitle>
                    <CardDescription className="mt-2">Загляните позже, когда администратор заархивирует сезон!</CardDescription>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {seasons.map(season => (
                        <Card key={season.id} className="bg-card/80 backdrop-blur-sm shadow-lg flex flex-col">
                            <CardHeader>
                                <CardTitle className="font-headline text-2xl">{season.name}</CardTitle>
                                <CardDescription className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Заархивировано {(season.createdAt as Timestamp).toDate().toLocaleDateString()}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow flex items-end">
                                <Button asChild className="w-full">
                                    <Link href={`/seasons/${season.id}`}>
                                        Посмотреть таблицу лидеров <ArrowRight className="ml-2" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

