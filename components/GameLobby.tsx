'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import GameRoom from '@/components/GameRoom'
import { Plus, Users, LogOut } from 'lucide-react'

interface GameRoom {
  id: string
  name: string
  host_id: string
  is_active: boolean
  player_count: number
}

export default function GameLobby({ user }: { user: User }) {
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [newRoomName, setNewRoomName] = useState('')
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchRooms()
    
    const roomSubscription = supabase
      .channel('game-rooms')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'game_rooms' }, 
        () => fetchRooms()
      )
      .subscribe()

    return () => {
      roomSubscription.unsubscribe()
    }
  }, [])

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from('game_rooms')
      .select(`
        *,
        game_players!inner (
          id
        )
      `)
      .eq('is_active', true)

    if (!error && data) {
      const roomsWithCount = data.map(room => ({
        ...room,
        player_count: Array.isArray(room.game_players) ? room.game_players.length : 0
      }))
      setRooms(roomsWithCount)
    }
  }

  const createRoom = async () => {
    if (!newRoomName.trim()) return
    
    setLoading(true)
    
    try {
      // First ensure user profile exists
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        console.error('User not authenticated:', userError)
        alert('Please sign in again.')
        setLoading(false)
        return
      }

      // Check if user profile exists in users table, create if not
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', userData.user.id)
        .single()

      if (!existingUser) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: userData.user.id,
              email: userData.user.email || '',
              username: userData.user.user_metadata?.username || userData.user.email?.split('@')[0] || 'Player'
            }
          ])

        if (profileError) {
          console.error('Error creating user profile:', profileError)
        }
      }

      const { data, error } = await supabase
        .from('game_rooms')
        .insert([
          {
            name: newRoomName,
            host_id: userData.user.id,
          }
        ])
        .select()

      if (error) {
        console.error('Error creating room:', error.message, error.details, error.hint)
        alert(`Failed to create room: ${error.message}`)
        setLoading(false)
        return
      }

      if (data?.[0]) {
        // Join the room as a player  
        const { error: joinError } = await supabase
          .from('game_players')
          .insert([
            {
              room_id: data[0].id,
              user_id: userData.user.id,
            }
          ])

        if (joinError) {
          console.error('Error joining room:', joinError.message, joinError.details)
          alert(`Created room but failed to join: ${joinError.message}`)
        }

        setActiveRoom(data[0].id)
        setNewRoomName('')
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred. Please try again.')
    }
    
    setLoading(false)
  }

  const joinRoom = async (roomId: string) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        alert('Please sign in again.')
        return
      }

      const { error } = await supabase
        .from('game_players')
        .insert([
          {
            room_id: roomId,
            user_id: userData.user.id,
          }
        ])

      if (error) {
        console.error('Error joining room:', error.message, error.details)
        if (error.code === '23505') {
          // User already in room, just join
          setActiveRoom(roomId)
        } else {
          alert(`Failed to join room: ${error.message}`)
        }
        return
      }

      setActiveRoom(roomId)
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred. Please try again.')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (activeRoom) {
    return (
      <GameRoom 
        roomId={activeRoom} 
        user={user} 
        onLeave={() => setActiveRoom(null)} 
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Game Lobby</h2>
        <Button onClick={handleSignOut} variant="outline">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Create New Room
            </CardTitle>
            <CardDescription>Start a new flashcard battle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createRoom()}
              />
              <Button onClick={createRoom} disabled={loading || !newRoomName.trim()}>
                Create
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Active Rooms
            </CardTitle>
            <CardDescription>Join an existing game</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {rooms.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No active rooms</p>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium">{room.name}</p>
                      <p className="text-sm text-gray-500">{room.player_count} players</p>
                    </div>
                    <Button
                      onClick={() => joinRoom(room.id)}
                      size="sm"
                    >
                      Join
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}