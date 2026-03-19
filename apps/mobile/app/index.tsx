import summary from "../../../packages/question-bank/data/normalized/summary.json";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Testovnice Medicina</Text>
        <Text style={styles.title}>iOS app základ je pripravený.</Text>
        <Text style={styles.text}>
          Dataset už obsahuje {summary.totalQuestions} normalizovaných otázok z
          biológie a chémie. Ďalší krok je obrazovka predmetov, test mód a progres.
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{summary.subjects.biology.questionCount}</Text>
          <Text style={styles.cardLabel}>Biológia</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{summary.subjects.chemistry.questionCount}</Text>
          <Text style={styles.cardLabel}>Chémia</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f0e6",
    padding: 20,
    gap: 16,
  },
  hero: {
    marginTop: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#fffaf2",
    borderWidth: 1,
    borderColor: "#ddcbb8",
    gap: 10,
  },
  eyebrow: {
    color: "#b44f2d",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    fontSize: 34,
    lineHeight: 36,
    color: "#1e1b18",
    fontWeight: "700",
  },
  text: {
    color: "#6d6259",
    fontSize: 16,
    lineHeight: 24,
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fffaf2",
    borderWidth: 1,
    borderColor: "#ddcbb8",
  },
  cardValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e1b18",
  },
  cardLabel: {
    marginTop: 4,
    color: "#6d6259",
    fontSize: 14,
  },
});
