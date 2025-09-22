'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trophy, Clock, Users } from 'lucide-react'

interface Player {
  id: string
  user_id: string
  score: number
  users: {
    username: string
  }
}

interface Flashcard {
  id: number
  question: string
  answer: string
  category: string
}

interface GameRoomProps {
  roomId: string
  user: User
  onLeave: () => void
}

export default function GameRoom({ roomId, user, onLeave }: GameRoomProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isHost, setIsHost] = useState(false)

  useEffect(() => {
    fetchPlayers()
    fetchCurrentCard()
    checkIfHost()

    const playersSubscription = supabase
      .channel(`game-players-${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `room_id=eq.${roomId}` },
        () => fetchPlayers()
      )
      .subscribe()

    const roomSubscription = supabase
      .channel(`game-room-${roomId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
        () => fetchCurrentCard()
      )
      .subscribe()

    return () => {
      playersSubscription.unsubscribe()
      roomSubscription.unsubscribe()
    }
  }, [roomId])

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('game_players')
      .select(`
        *,
        users (username)
      `)
      .eq('room_id', roomId)
      .order('score', { ascending: false })

    if (!error && data) {
      setPlayers(data)
    }
  }

  const fetchCurrentCard = async () => {
    const { data: roomData } = await supabase
      .from('game_rooms')
      .select('current_card_id')
      .eq('id', roomId)
      .single()

    if (roomData?.current_card_id) {
      const { data: cardData } = await supabase
        .from('flashcards')
        .select('*')
        .eq('id', roomData.current_card_id)
        .single()

      if (cardData) {
        setCurrentCard(cardData)
      }
    }
  }

  const checkIfHost = async () => {
    const { data } = await supabase
      .from('game_rooms')
      .select('host_id')
      .eq('id', roomId)
      .single()

    setIsHost(data?.host_id === user.id)
  }

  const startNewRound = async () => {
    if (!isHost) return
    
    setLoading(true)
    const { data: cards } = await supabase
      .from('flashcards')
      .select('*')
      .limit(1)
      .order('RANDOM()')

    if (cards?.[0]) {
      await supabase
        .from('game_rooms')
        .update({ current_card_id: cards[0].id })
        .eq('id', roomId)
    }
    
    setLoading(false)
    setUserAnswer('')
    setFeedback(null)
  }

  const submitAnswer = async () => {
    if (!currentCard || !userAnswer.trim()) return

    setLoading(true)
    
    try {
      const isCorrect = userAnswer.toLowerCase().trim() === currentCard.answer.toLowerCase().trim()

      if (isCorrect) {
        const currentPlayer = players.find(p => p.user_id === user.id)
        const newScore = (currentPlayer?.score || 0) + 1
        
        const { error } = await supabase
          .from('game_players')
          .update({ score: newScore })
          .eq('room_id', roomId)
          .eq('user_id', user.id)

        if (!error) {
          await supabase
            .from('match_history')
            .insert([
              {
                room_id: roomId,
                card_id: currentCard.id,
                winner_id: user.id,
              }
            ])

          setFeedback({ message: 'Correct! You earned a point!', type: 'success' })
          
          setTimeout(() => {
            if (isHost) startNewRound()
          }, 2000)
        } else {
          console.error('Error updating score:', error)
          setFeedback({ message: 'Error updating score. Please try again.', type: 'error' })
        }
      } else {
        setFeedback({ message: `Wrong! The correct answer was: ${currentCard.answer}`, type: 'error' })
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setFeedback({ message: 'An unexpected error occurred.', type: 'error' })
    }

    setLoading(false)
    setUserAnswer('')
  }

  const leaveRoom = async () => {
    await supabase
      .from('game_players')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id)

    onLeave()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Button onClick={leaveRoom} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Leave Room
        </Button>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>{players.length} players</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Flashcard Challenge</span>
                {currentCard && (
                  <Badge variant="secondary">{currentCard.category}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentCard ? (
                <div className="space-y-6">
                  <div className="text-center p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">
                      {currentCard.question}
                    </h3>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      placeholder="Your answer..."
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !loading && submitAnswer()}
                      disabled={loading}
                    />
                    <Button 
                      onClick={submitAnswer}
                      disabled={loading || !userAnswer.trim()}
                    >
                      Submit
                    </Button>
                  </div>

                  {feedback && (
                    <div className={`p-4 rounded-lg ${
                      feedback.type === 'success' 
                        ? 'bg-green-50 text-green-800 border border-green-200' 
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      {feedback.message}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 mb-4">Waiting for the next round...</p>
                  {isHost && (
                    <Button onClick={startNewRound} disabled={loading}>
                      Start New Round
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="h-5 w-5 mr-2" />
                Leaderboard
              </CardTitle>
              <CardDescription>Live scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {players.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      player.user_id === user.id 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="font-bold mr-3 text-gray-500">
                        #{index + 1}
                      </span>
                      <span className="font-medium">
                        {player.users?.username}
                        {player.user_id === user.id && ' (You)'}
                      </span>
                    </div>
                    <Badge variant={index === 0 ? 'default' : 'secondary'}>
                      {player.score}
                    </Badge>
                  </div>
                ))}
                {players.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No players yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}