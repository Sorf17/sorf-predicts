
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Swords, Trophy } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center text-center py-12 md:py-20">
      
      <div className="inline-block p-4 bg-primary/10 rounded-full">
        <div className="inline-block p-3 bg-primary/20 rounded-full">
          <Swords className="w-16 h-16 text-primary" />
        </div>
      </div>
      
      <h1 className="text-5xl md:text-7xl font-bold font-headline mt-6 bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
        LoL Predict
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Докажите свои знания в League of Legends. Прогнозируйте исходы матчей, поднимайтесь в рейтинге и хвастайтесь своими успехами.
      </p>
      
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Link href="/predictions" className="group">
          <Card className="bg-card/80 backdrop-blur-sm border-2 border-transparent hover:border-primary transition-all duration-300 transform hover:-translate-y-1 cursor-pointer h-full text-left shadow-lg hover:shadow-primary/20">
            <CardHeader className="flex-row items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-md">
                <Swords className="w-8 h-8 text-accent" />
              </div>
              <CardTitle className="font-headline text-2xl">Сделать прогнозы</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Просматривайте предстоящие матчи и делайте свои прогнозы на победителя и итоговый счет.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
        <Link href="/rankings" className="group">
          <Card className="bg-card/80 backdrop-blur-sm border-2 border-transparent hover:border-primary transition-all duration-300 transform hover:-translate-y-1 cursor-pointer h-full text-left shadow-lg hover:shadow-primary/20">
            <CardHeader className="flex-row items-center gap-4">
               <div className="p-3 bg-accent/10 rounded-md">
                <Trophy className="w-8 h-8 text-accent" />
              </div>
              <CardTitle className="font-headline text-2xl">Посмотреть рейтинги</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Проверьте таблицу лидеров, чтобы увидеть, как вы выглядите на фоне других предсказателей. Узнайте, кто на вершине своей игры.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

