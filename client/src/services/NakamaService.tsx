import { Client, Session, Socket, MatchmakerMatched, MatchData } from '@heroiclabs/nakama-js';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// This interface must match the GameState struct in your Go code
export interface GameState {
  board: string[];
  currentTurn: string;
  winner: string;
  gameOver: boolean;
  players: { [userId: string]: 'X' | 'O' };
}

class NakamaService {
  private client: Client;
  public session: Session | null = null;
  public socket: Socket | null = null;
  private matchId: string | null = null;

  constructor() {
    // Ensure this IP is correct for your setup
    // 'localhost' for web, '10.0.2.2' for Android Emu, '192.168.x.x' for physical device
    this.client = new Client('defaultkey', 'localhost', '7350', false);
  }

  public async authenticate(): Promise<Session> {
    const deviceId = uuidv4();
    this.session = await this.client.authenticateDevice(deviceId, true);
    this.socket = this.client.createSocket(false);
    await this.socket.connect(this.session, false);
    return this.session;
  }

  public async connect(): Promise<void> {
    if (!this.session || !this.socket) {
      await this.authenticate();
    }
  }

  public async findMatch(query = '*', minPlayers = 2, maxPlayers = 2): Promise<MatchmakerMatched> {
    if (!this.socket) throw new Error('Socket not connected.');

    const ticket = await this.socket.addMatchmaker(query, minPlayers, maxPlayers);

    return new Promise((resolve) => {
      this.socket!.onmatchmakermatched = (matched) => {
        console.log('Match found:', matched);
        resolve(matched);
      };
    });
  }

  public async leaveMatchmaker(ticket: string): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');
    await this.socket.removeMatchmaker(ticket);
    console.log(`Left matchmaking with ticket: ${ticket}`);
  }

  public async joinMatch(matchId: string, onStateChange: (state: GameState) => void): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');
    this.matchId = matchId;

    // The listener for real-time game state updates
    this.socket.onmatchdata = (matchData: MatchData) => {
      try {
        const decodedState = JSON.parse(new TextDecoder().decode(matchData.data)) as GameState;
        onStateChange(decodedState);
      } catch (e) {
        console.error("Error decoding match data:", e);
      }
    };

    const match = await this.socket.joinMatch(matchId);
    console.log("Successfully joined match:", match);
  }

  public async sendMove(position: number): Promise<void> {
    if (!this.socket || !this.matchId) throw new Error('Not in a match');
    
    // OpCode 1 is for 'move' as defined in your Go code
    const moveData = JSON.stringify({ position });
    await this.socket.sendMatchState(this.matchId, 1, new TextEncoder().encode(moveData));
    console.log(`Sent move for position ${position}`);
  }
  
  public async leaveMatch(): Promise<void> {
      if (!this.socket || !this.matchId) return;
      await this.socket.leaveMatch(this.matchId);
      this.matchId = null;
      console.log("Left the match.");
  }
}

export default new NakamaService();
