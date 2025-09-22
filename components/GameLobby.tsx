'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import GameRoom from './GameRoom'
import { Plus, Users, LogOut } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface GameRoomType {
  id: string
  name: string
  host_id: string
  is_active: boolean
  player_count: number
}

export default function GameLobby({ user }: { user: User }) {
  const [rooms, setRooms] = useState<GameRoomType[]>([])
  const [newRoomName, setNewRoomName] = useState('')
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchRooms()
    
    const roomSubscription = supabase
      .channel('public:game_rooms')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'game_rooms' }, 
        () => fetchRooms()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(roomSubscription)
    }
  }, [])

  const fetchRooms = async () => {
    // Fetch rooms and count players using a left join.
    // The query now correctly includes rooms with zero players.
    const { data, error } = await supabase
      .from('game_rooms')
      .select(`
        *,
        game_players (
          id
        )
      `)
      .eq('is_active', true)

    if (error) {
        console.error("Error fetching rooms:", error)
        toast({
            title: "Error",
            description: "Could not fetch game rooms.",
            variant: "destructive"
        })
        return
    }
    
    if (data) {
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "Authentication Error", description: "You must be logged in to create a room.", variant: "destructive" })
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('game_rooms')
        .insert([{ name: newRoomName, host_id: user.id }])
        .select()
        .single()

      if (error) {
        console.error('Error creating room:', error)
        toast({ title: 'Error', description: `Failed to create room: ${error.message}`, variant: 'destructive' })
        setLoading(false)
        return
      }

      if (data) {
        const { error: joinError } = await supabase
          .from('game_players')
          .insert([{ room_id: data.id, user_id: user.id }])

        if (joinError) {
          console.error('Error joining room:', joinError)
          toast({ title: 'Error', description: `Created room but failed to join: ${joinError.message}`, variant: 'destructive' })
        } else {
          toast({ title: 'Success!', description: `Room "${newRoomName}" created and joined.` })
          setActiveRoom(data.id)
          setNewRoomName('')
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      toast({ title: 'Error', description: 'An unexpected error occurred. Please try again.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const joinRoom = async (roomId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "Authentication Error", description: "Please sign in again to join a room.", variant: "destructive" })
        return
      }

      const { error } = await supabase
        .from('game_players')
        .insert([{ room_id: roomId, user_id: user.id }])

      if (error) {
        console.error('Error joining room:', error)
        if (error.code === '23505') { // Unique constraint violation
          // User is already in the room, let them join
          setActiveRoom(roomId)
        } else {
          toast({ title: "Error", description: `Failed to join room: ${error.message}`, variant: "destructive" })
        }
        return
      }

      setActiveRoom(roomId)
    } catch (err) {
      console.error('Unexpected error:', err)
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' })
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
                {loading ? 'Creating...' : 'Create'}
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

