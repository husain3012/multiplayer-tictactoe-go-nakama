import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, BackHandler, Modal, Animated, Easing, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { GameState } from '../services/NakamaService';
import NakamaService from '../services/NakamaService';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';

type GameScreenRouteProp = RouteProp<RootStackParamList, 'Game'>;

const GameScreen: React.FC = () => {
  const navigation = useNavigation<import('@react-navigation/native').NavigationProp<RootStackParamList>>();
  const route = useRoute<GameScreenRouteProp>();
  const { matchId } = route.params;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerSymbol, setPlayerSymbol] = useState<'X' | 'O' | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Animations
  const cellScales = useRef(Array(9).fill(null).map(() => new Animated.Value(0))).current;
  const cellPressScales = useRef(Array(9).fill(null).map(() => new Animated.Value(1))).current;
  const boardScale = useRef(new Animated.Value(0.95)).current;
  const boardOpacity = useRef(new Animated.Value(0)).current;
  const turnPulse = useRef(new Animated.Value(1)).current;
  const modalScale = useRef(new Animated.Value(0.9)).current;
  const modalFade = useRef(new Animated.Value(0)).current;

  // Track which cells have already animated once
  const animatedOnceRef = useRef<Set<number>>(new Set());

  // Reset per-match
  useEffect(() => {
    animatedOnceRef.current = new Set();
    cellScales.forEach(v => v.setValue(0)); // ensure fresh pop-in for new match
  }, [matchId, cellScales]);

  // Board entrance animation once
  useEffect(() => {
    Animated.parallel([
      Animated.timing(boardScale, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(boardOpacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [boardScale, boardOpacity]);

  // Join match and wire listeners (strictly once per matchId)
  useEffect(() => {
    let left = false;

    const setup = async () => {
      try {
        await NakamaService.joinMatch(matchId, (newState) => {
          // Animate newly filled cells only once
          newState.board.forEach((cell, i) => {
            const wasEmpty = gameState?.board?.[i] === '' || gameState?.board?.[i] === undefined;
            const nowFilled = cell !== '';
            const notAnimatedYet = !animatedOnceRef.current.has(i);

            if (nowFilled && wasEmpty && notAnimatedYet) {
              cellScales[i].setValue(0.6);
              Animated.spring(cellScales[i], {
                toValue: 1,
                friction: 6,
                tension: 120,
                useNativeDriver: true,
              }).start(() => {
                animatedOnceRef.current.add(i); // mark index as animated exactly once
              });
            }
          });

          setGameState(newState);

          // Assign player symbol (X/O) once
          if (!playerSymbol) {
            const myUserId = NakamaService.session?.user_id;
            if (myUserId && newState.players[myUserId]) {
              setPlayerSymbol(newState.players[myUserId]);
            }
          }

          // Turn pulse cue
          const myTurn = newState.currentTurn === playerSymbol && !newState.gameOver;
          if (myTurn) {
            Animated.sequence([
              Animated.timing(turnPulse, { toValue: 1.06, duration: 160, useNativeDriver: true }),
              Animated.timing(turnPulse, { toValue: 1, duration: 160, useNativeDriver: true }),
            ]).start();
          }

          // Modal control driven by local state
          if (newState.gameOver) {
            setModalVisible(true);
            modalScale.setValue(0.9);
            modalFade.setValue(0);
            Animated.parallel([
              Animated.timing(modalScale, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(modalFade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            ]).start();
          } else {
            setModalVisible(false);
          }
        });
      } catch (error) {
        Alert.alert('Error', 'Unable to join the match.');
        navigation.goBack();
      }
    };

    setup();

    const cleanup = () => {
      if (left) return;
      left = true;
      NakamaService.leaveMatch();
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      cleanup();
      navigation.goBack();
      return true;
    });

    return () => {
      backHandler.remove();
      cleanup();
    };
  }, [matchId]); // do not include dynamic state to avoid premature cleanup

  const handleCellPress = (index: number) => {
    if (!gameState || gameState.gameOver || gameState.currentTurn !== playerSymbol || gameState.board[index] !== '') {
      return;
    }
    // Press feedback
    Animated.sequence([
      Animated.timing(cellPressScales[index], { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.timing(cellPressScales[index], { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start(() => {
      NakamaService.sendMove(index);
    });
  };

  const getStatusText = () => {
    if (!gameState) return 'Loading Game...';
    if (gameState.gameOver) return 'Game Over';
    return gameState.currentTurn === playerSymbol ? 'Your Turn' : "Opponent's Turn";
  };

  if (!gameState) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textSecondary }}>Joining match...</Text>
      </View>
    );
  }

  const isMyTurn = gameState.currentTurn === playerSymbol && !gameState.gameOver;

  const handleBackToHome = () => {
    setModalVisible(false);
    navigation.reset({ index: 0, routes: [{ name: 'Home' as keyof RootStackParamList }] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Tic-Tac-Toe</Text>
        <View style={styles.playerInfo}>
          <Text style={styles.symbolText}>You are: </Text>
          <Text style={[styles.symbol, { color: playerSymbol === 'X' ? colors.xColor : colors.oColor }]}>{playerSymbol}</Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.board,
          !isMyTurn && styles.boardDisabled,
          { transform: [{ scale: boardScale }], opacity: boardOpacity },
        ]}
      >
        {/* Grid overlay */}
        <View pointerEvents="none" style={styles.gridOverlay}>
          {/* Vertical lines */}
          <View style={[styles.vLine, { left: 106 }]} />
          <View style={[styles.vLine, { left: 213 }]} />
          {/* Horizontal lines */}
          <View style={[styles.hLine, { top: 106 }]} />
          <View style={[styles.hLine, { top: 213 }]} />
        </View>

        {gameState.board.map((cell, index) => {
          const scaleIn = cellScales[index];
          const pressScale = cellPressScales[index];
          const composedScale = Animated.multiply(scaleIn, pressScale);
          return (
            <TouchableOpacity
              key={index}
              style={styles.cell}
              onPress={() => handleCellPress(index)}
              disabled={!!cell || !isMyTurn}
              activeOpacity={0.9}
            >
              <Animated.Text
                style={[
                  styles.cellText,
                  { color: cell === 'X' ? colors.xColor : colors.oColor },
                  { transform: [{ scale: composedScale }] },
                ]}
              >
                {cell}
              </Animated.Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      <Animated.Text
        style={[
          styles.status,
          { color: isMyTurn ? colors.primary : colors.textSecondary },
          isMyTurn ? { transform: [{ scale: turnPulse }] } : null,
        ]}
      >
        {getStatusText()}
      </Animated.Text>

      <Modal transparent visible={modalVisible} animationType="none">
        <View style={styles.modalContainer}>
          <Animated.View style={[styles.modalContent, { opacity: modalFade, transform: [{ scale: modalScale }] }]}>
            <Text style={styles.modalTitle}>
              {gameState.winner ? (gameState.winner === playerSymbol ? 'You Won! 🎉' : 'You Lost 😞') : "It's a Draw!"}
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={handleBackToHome}>
              <Text style={styles.modalButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const CELL_FONT_FAMILY =
  Platform.select({
    ios: 'HelveticaNeue-CondensedBold',
    android: 'sans-serif-condensed',
    default: 'System',
  }) || 'System';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  headerContainer: {
    position: 'absolute',
    top: 60,
    alignItems: 'center',
  },
  header: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  symbolText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  symbol: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  status: {
    position: 'absolute',
    bottom: 80,
    fontSize: 22,
    fontWeight: '600',
  },
  board: {
    width: 320,
    height: 320,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  boardDisabled: {
    opacity: 0.6,
  },
  // Grid overlay and lines
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 320,
    height: 320,
  },
  vLine: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: 320,
    backgroundColor: '#444',
    opacity: 0.9,
  },
  hLine: {
    position: 'absolute',
    left: 0,
    width: 320,
    height: 2,
    backgroundColor: '#444',
    opacity: 0.9,
  },
  cell: {
    width: '33.333%',
    height: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 72,
    fontWeight: '900',
    fontFamily: CELL_FONT_FAMILY,
    letterSpacing: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    padding: 30,
    backgroundColor: colors.surface,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 20,
  },
  modalTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 30,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  modalButtonText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default GameScreen;
