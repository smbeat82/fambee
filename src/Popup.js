import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';

export default function Popup({ visible, title, options, onClose }) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.popup}>
          {title && <Text style={styles.title}>{title}</Text>}
          {title && <View style={styles.divider} />}
          {options.map((opt, i) => (
            <React.Fragment key={i}>
              {i > 0 && !title && <View style={styles.divider} />}
              {i > 0 && title && <View style={styles.divider} />}
              <TouchableOpacity style={styles.option} onPress={opt.onPress}>
                <Text style={[styles.optionText, opt.danger && styles.danger]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
          <View style={styles.cancelDivider} />
          <TouchableOpacity style={styles.option} onPress={onClose}>
            <Text style={styles.cancelText}>취소</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  popup: { backgroundColor: '#fff', borderRadius: 14, minWidth: 200, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
  title: { fontSize: 15, fontWeight: '600', color: '#333', textAlign: 'center', paddingVertical: 14, paddingHorizontal: 24 },
  option: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  optionText: { fontSize: 15, color: '#333' },
  danger: { color: '#F44336' },
  cancelText: { fontSize: 15, color: '#999' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#eee' },
  cancelDivider: { height: 6, backgroundColor: '#f5f5f5' },
});
