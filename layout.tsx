
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download } from "lucide-react"
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, collectionGroup } from 'firebase/firestore';
import type { Match, User, Prediction } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';

export default function AdminPage() {
  const { toast } = useToast();
  const { user: currentUser, loading: authLoading } = useAuth();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.email === 'sorf17@mail.ru';

  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const [mSnap, uSnap, pSnap] = await Promise.all([
        getDocs(query(collection(db, 'matches'), orderBy('matchDate', 'desc'))),
        getDocs(collection(db, 'users')),
        getDocs(collectionGroup(db, 'predictions'))
      ]);

      setMatches(mSnap.docs.map(d => ({ id: d.id, ...d.data(), matchDate: d.data().matchDate?.toDate() } as any)));
      setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      setPredictions(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка', description: 'Не удалось загрузить данные', variant: 'destructive' });
    } finally {
      setLoadingData(false);
    }
  };

  const handleDownloadGrid = async () => {
    if (!gridRef.current) return;
    try {
      const dataUrl = await toPng(gridRef.current, { 
        cacheBust: true, 
        backgroundColor: '#020617',
        pixelRatio: 2,
        skipFonts: true
      });
      const link = document.createElement('a');
      link.download = `lol-predict-grid-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить изображение.', variant: 'destructive' });
    }
  };

  const activeUsersInGrid = useMemo(() => {
    const userIds = new Set(predictions.filter(p => selectedMatchIds.includes(p.matchId)).map(p => p.userId));
    return users.filter(u => userIds.has(u.id)).sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [predictions, selectedMatchIds, users]);

  if (authLoading || loadingData) return <div className="p-8 text-center">Загрузка...</div>;
  if (!isAdmin) return <div className="p-8 text-center text-destructive">Доступ запрещен.</div>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-headline font-bold text-primary mb-8">Панель администратора</h1>
      <Tabs defaultValue="grid">
        <TabsList className="mb-8 grid grid-cols-4 bg-muted">
          <TabsTrigger value="matches">Матчи</TabsTrigger>
          <TabsTrigger value="teams">Команды</TabsTrigger>
          <TabsTrigger value="grid">Сетка</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Экспорт сетки прогнозов</CardTitle>
                <CardDescription>Выберите матчи для формирования сводной таблицы</CardDescription>
              </div>
              <Button onClick={handleDownloadGrid} disabled={selectedMatchIds.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Скачать PNG
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-6 p-4 bg-muted/30 rounded-lg">
                {matches.slice(0, 15).map(m => (
                  <Button 
                    key={m.id} 
                    variant={selectedMatchIds.includes(m.id) ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setSelectedMatchIds(prev => 
                      prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                    )}
                  >
                    {m.teamAShortName || m.teamA} vs {m.teamBShortName || m.teamB}
                  </Button>
                ))}
              </div>

              {selectedMatchIds.length > 0 && (
                <div ref={gridRef} className="bg-[#020617] text-white border border-primary/10 rounded-xl p-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="min-w-[150px] font-black uppercase text-[10px] text-white/50 border-white/10">Матч</TableHead>
                        {activeUsersInGrid.map(u => (
                          <TableHead key={u.id} className="text-center px-2 border-white/10">
                            <div className="flex flex-col items-center">
                              <Avatar className="h-8 w-8 mb-1 border border-primary/20">
                                <AvatarImage src={u.avatarUrl} />
                                <AvatarFallback>{u.username[0]}</AvatarFallback>
                              </Avatar>
                              <span className="text-[10px] font-bold uppercase truncate max-w-[80px] text-white">{u.username}</span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matches.filter(m => selectedMatchIds.includes(m.id)).map(m => (
                        <TableRow key={m.id} className="hover:bg-white/5 border-white/10">
                          <TableCell className="border-r border-white/10 py-4 px-3">
                            <div className="flex flex-col text-[10px] font-black uppercase leading-tight text-white">
                              <span>{m.teamAShortName || m.teamA}</span>
                              <span className="text-accent italic">vs</span>
                              <span>{m.teamBShortName || m.teamB}</span>
                            </div>
                          </TableCell>
                          {activeUsersInGrid.map(u => {
                            const p = predictions.find(pred => pred.matchId === m.id && pred.userId === u.id);
                            return (
                              <TableCell key={u.id} className="text-center p-2 border-white/10">
                                {p ? (
                                  <div className="flex flex-col items-center">
                                    <div className="w-6 h-6 relative mb-1">
                                      <img 
                                        src={p.predictedWinner === 'teamA' ? m.teamALogo : m.teamBLogo} 
                                        alt="win" 
                                        crossOrigin="anonymous"
                                        className={cn("w-full h-full object-contain", ((p.predictedWinner === 'teamA' && m.teamAHasDarkLogo) || (p.predictedWinner === 'teamB' && m.teamBHasDarkLogo)) && "filter drop-shadow-[0_0_2px_white]")} 
                                      />
                                    </div>
                                    <span className="text-[10px] font-black text-accent">{p.predictedScore}</span>
                                  </div>
                                ) : <span className="opacity-10">-</span>}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
