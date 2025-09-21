import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Session } from '@heroiclabs/nakama-js';

import { HomeScreenNavigationProp } from '../navigation/types';
import NakamaService from '../services/NakamaService';
import StyledButton from '../components/StyledButton'; // Assumes you have this styled component
import { colors } from '../theme';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [isConnecting, setIsConnecting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  // For fade-in animations
  const titleAnim = React.useRef(new Animated.Value(0)).current;
  const buttonAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const connectToServer = async () => {
      try {
        const session = await NakamaService.authenticate();
        setSession(session);
        // Animate the content in once connected
        Animated.timing(titleAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        Animated.timing(buttonAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }).start();
      } catch (error) {
        Alert.alert('Connection Error', 'Could not connect to the server. Please try again later.');
      } finally {
        setIsConnecting(false);
      }
    };
    connectToServer();
  }, [titleAnim, buttonAnim]);

  const handleFindMatch = () => {
    if (session) {
      navigation.navigate('Matchmaking', { mode: 'quick' });
    } else {
      Alert.alert('Not Connected', 'You are not connected to the server. Please wait or restart the app.');
    }
  };

  return (
    <View style={styles.container}>
      {isConnecting ? (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Connecting to server...</Text>
        </>
      ) : (
        <>
          <Animated.View style={{ opacity: titleAnim, transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
            <Text style={styles.title}>Tic-Tac-Toe</Text>
            <Text style={styles.subtitle}>MULTIPLAYER</Text>
          </Animated.View>

          <Animated.View style={{ opacity: buttonAnim }}>
            <StyledButton 
              title="Find Match" 
              onPress={handleFindMatch} 
              disabled={!session}
            />
          </Animated.View>
        </>
      )}
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
    fontSize: 52,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 100,
    marginTop: -5,
  },
  statusText: {
    marginTop: 15,
    fontSize: 16,
    color: colors.textSecondary,
  },
});

export default HomeScreen;
