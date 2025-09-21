import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, BackHandler, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MatchmakerMatched } from '@heroiclabs/nakama-js';

import NakamaService from '../services/NakamaService';
import { HomeScreenNavigationProp } from '../navigation/types';
import StyledButton from '../components/StyledButton';
import { colors } from '../theme';

const MatchmakingScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [matchmakingTicket, setMatchmakingTicket] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fade-in animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    const startMatchmaking = async () => {
      try {
        const matched = await NakamaService.findMatch();
        if (matched.match_id) {
          navigation.navigate('Game', { matchId: matched.match_id });
        } else {
          setMatchmakingTicket(matched.ticket);
        }
      } catch (error) {
        Alert.alert("Matchmaking Error", "Could not find a match. Please try again.");
        navigation.goBack();
      }
    };

    startMatchmaking();

    const backAction = () => {
      handleCancel();
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => {
      backHandler.remove();
      if (NakamaService.socket) {
        NakamaService.socket.onmatchmakermatched = () => {};
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, matchmakingTicket]);

  const handleCancel = async () => {
    if (matchmakingTicket && !isCancelling) {
      setIsCancelling(true);
      try {
        await NakamaService.leaveMatchmaker(matchmakingTicket);
      } catch (e) {
        // Ignore errors on cancel
      }
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.title}>Finding Opponent...</Text>
        <Text style={styles.subtitle}>Hang tight! We're matching you with a worthy rival.</Text>
        <StyledButton
          title={isCancelling ? "Cancelling..." : "Cancel"}
          onPress={handleCancel}
          disabled={isCancelling}
          style={styles.cancelButton}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    marginTop: 30,
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 30,
  },
  cancelButton: {
    width: 160,
    alignSelf: 'center',
  },
});

export default MatchmakingScreen;