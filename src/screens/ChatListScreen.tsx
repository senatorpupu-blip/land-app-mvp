import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  SafeAreaView,
  RefreshControl
} from 'react-native';
import { theme } from '../config/theme';
import { Chat } from '../types';

interface ChatListScreenProps {
  navigation: any;
  userId: string;
}

// Mock data for MVP demo
const MOCK_CHATS: (Chat & { otherUserName: string; plotTitle: string })[] = [
  {
    id: '1',
    plotId: '1',
    ownerId: 'owner1',
    clientId: 'client1',
    lastMessage: 'Is this plot still available?',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 5),
    createdAt: new Date(Date.now() - 1000 * 60 * 60),
    otherUserName: 'John Doe',
    plotTitle: 'Sunny Meadow Plot',
  },
  {
    id: '2',
    plotId: '2',
    ownerId: 'owner2',
    clientId: 'client1',
    lastMessage: 'I would like to schedule a visit',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    otherUserName: 'Jane Smith',
    plotTitle: 'Forest Edge Land',
  },
];

export const ChatListScreen: React.FC<ChatListScreenProps> = ({ navigation, userId }) => {
  const [chats, setChats] = useState(MOCK_CHATS);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // In production, fetch from Firebase
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  const handleChatPress = (chat: typeof MOCK_CHATS[0]) => {
    navigation.navigate('Chat', {
      chatId: chat.id,
      plotId: chat.plotId,
      ownerId: chat.ownerId,
      plotTitle: chat.plotTitle,
      otherUserName: chat.otherUserName,
    });
  };

  const renderChatItem = ({ item }: { item: typeof MOCK_CHATS[0] }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => handleChatPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.otherUserName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.otherUserName}
          </Text>
          <Text style={styles.time}>
            {item.lastMessageAt ? formatTime(item.lastMessageAt) : ''}
          </Text>
        </View>
        <Text style={styles.plotTitle} numberOfLines={1}>
          {item.plotTitle}
        </Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage || 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation by contacting a plot owner
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  list: {
    flexGrow: 1,
  },
  chatItem: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  avatarText: {
    color: theme.colors.background,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  userName: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginRight: theme.spacing.sm,
  },
  time: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  plotTitle: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
  lastMessage: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 50 + theme.spacing.md * 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
});
