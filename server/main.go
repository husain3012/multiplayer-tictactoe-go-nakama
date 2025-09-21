package main

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

type Move struct {
	Position int `json:"position"`
}

type GameState struct {
	Board       [9]string         `json:"board"`
	CurrentTurn string            `json:"currentTurn"`
	Winner      string            `json:"winner"`
	GameOver    bool              `json:"gameOver"`
	Players     map[string]string `json:"players"`
}

const (
	OpCodeMove       = 1
	OpCodeUpdate     = 2
	OpCodeGameOver   = 3
	OpCodePlayerJoin = 4
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	if err := initializer.RegisterMatch("tictactoe", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &MatchHandler{}, nil
	}); err != nil {
		return err
	}
	if err := initializer.RegisterMatchmakerMatched(MatchmakerMatched); err != nil {
		return err
	}
	logger.Info("Tic-Tac-Toe Go module loaded.")
	return nil
}

type MatchHandler struct{}

func (m *MatchHandler) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	initialState := &GameState{
		Board:       [9]string{"", "", "", "", "", "", "", "", ""},
		CurrentTurn: "X", // Player X always starts
		Winner:      "",
		GameOver:    false,
		Players:     make(map[string]string),
	}
	tickRate := 5
	label := "TicTacToe_Match"
	return initialState, tickRate, label
}

func (m *MatchHandler) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	gameState := state.(*GameState)
	if len(gameState.Players) >= 2 {
		return state, false, "Match is full"
	}
	return state, true, ""
}

func (m *MatchHandler) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	gameState := state.(*GameState)
	for _, p := range presences {
		// First player to join is always 'X'
		if len(gameState.Players) == 0 {
			gameState.Players[p.GetUserId()] = "X"
		} else {
			gameState.Players[p.GetUserId()] = "O"
		}
		logger.Info("Player %s joined as %s.", p.GetUserId(), gameState.Players[p.GetUserId()])
	}

	// Only broadcast the "join" and initial state when the match is full
	if len(gameState.Players) == 2 {
		payload, _ := json.Marshal(gameState)
		// OpCodePlayerJoin (4) is a good practice to let clients know the game is ready
		dispatcher.BroadcastMessage(int64(OpCodePlayerJoin), payload, nil, nil, true)
		logger.Info("Both players have joined. Broadcasting initial game state.")
	}

	return gameState
}

// --- CORRECTED MATCH LEAVE LOGIC ---
func (m *MatchHandler) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	gameState := state.(*GameState)

	for _, p := range presences {
		logger.Info("Player %s left the match.", p.GetUserId())
		delete(gameState.Players, p.GetUserId())
	}

	// If a player leaves mid-game, declare the other player the winner.
	if len(gameState.Players) == 1 && !gameState.GameOver {
		gameState.GameOver = true
		// Find the remaining player and declare them the winner.
		for _, symbol := range gameState.Players {
			gameState.Winner = symbol
		}
		payload, _ := json.Marshal(gameState)
		dispatcher.BroadcastMessage(int64(OpCodeGameOver), payload, nil, nil, true)
		logger.Info("A player left mid-game. Ending match and declaring winner.")
	}

	return gameState
}

func (m *MatchHandler) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	gameState := state.(*GameState)

	// Don't process any moves if the game is already over or not full yet
	if gameState.GameOver || len(gameState.Players) < 2 {
		return gameState
	}

	for _, msg := range messages {
		if msg.GetOpCode() != OpCodeMove {
			continue // Ignore messages that aren't moves
		}

		playerSymbol, ok := gameState.Players[msg.GetUserId()]
		if !ok || playerSymbol != gameState.CurrentTurn {
			continue // Not this player's turn, or player not in match
		}

		var move Move
		if err := json.Unmarshal(msg.GetData(), &move); err != nil {
			logger.Warn("Could not decode move data: %v", err)
			continue
		}

		if move.Position < 0 || move.Position > 8 || gameState.Board[move.Position] != "" {
			continue // Invalid move (out of bounds or cell already taken)
		}

		// Apply the move
		gameState.Board[move.Position] = playerSymbol

		// Check for win condition
		if winner, isDraw := checkWinCondition(gameState.Board); winner != "" || isDraw {
			gameState.GameOver = true
			gameState.Winner = winner
		} else {
			// Switch turns
			if gameState.CurrentTurn == "X" {
				gameState.CurrentTurn = "O"
			} else {
				gameState.CurrentTurn = "X"
			}
		}

		// Broadcast the updated state to all players
		opCode := OpCodeUpdate
		if gameState.GameOver {
			opCode = OpCodeGameOver
		}
		payload, _ := json.Marshal(gameState)
		dispatcher.BroadcastMessage(int64(opCode), payload, nil, nil, true)
	}

	return gameState
}

func (m *MatchHandler) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *MatchHandler) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, data
}

func MatchmakerMatched(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, entries []runtime.MatchmakerEntry) (string, error) {
	matchID, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{})
	if err != nil {
		return "", err
	}
	return matchID, nil
}

func checkWinCondition(board [9]string) (winner string, isDraw bool) {
	winConditions := [][]int{
		{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, // Rows
		{0, 3, 6}, {1, 4, 7}, {2, 5, 8}, // Columns
		{0, 4, 8}, {2, 4, 6}, // Diagonals
	}
	for _, wc := range winConditions {
		if board[wc[0]] != "" && board[wc[0]] == board[wc[1]] && board[wc[1]] == board[wc[2]] {
			return board[wc[0]], false
		}
	}
	isBoardFull := true
	for _, cell := range board {
		if cell == "" {
			isBoardFull = false
			break
		}
	}
	if isBoardFull {
		return "", true // It's a draw
	}
	return "", false // Game is not over
}
