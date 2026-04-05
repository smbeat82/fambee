import React, { useState, useRef } from 'react';
import { View, Image, TouchableOpacity, Text, Modal, StyleSheet, Dimensions, PanResponder } from 'react-native';

const SCREEN = Dimensions.get('window');
const CROP_SIZE = SCREEN.width * 0.75;

export default function CropModal({ visible, imageUri, onCrop, onClose }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ w: CROP_SIZE, h: CROP_SIZE });
  const lastOffset = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastOffset.current = { ...offset };
      },
      onPanResponderMove: (_, gesture) => {
        setOffset({
          x: lastOffset.current.x + gesture.dx,
          y: lastOffset.current.y + gesture.dy,
        });
      },
    })
  ).current;

  const onImageLoad = (uri) => {
    Image.getSize(uri, (w, h) => {
      const ratio = Math.max(CROP_SIZE / w, CROP_SIZE / h);
      setImageSize({ w: w * ratio, h: h * ratio });
      setOffset({ x: 0, y: 0 });
      setScale(1);
    });
  };

  React.useEffect(() => {
    if (visible && imageUri) {
      onImageLoad(imageUri);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      lastOffset.current = { x: 0, y: 0 };
    }
  }, [visible, imageUri]);

  const handleCrop = () => {
    const imgW = imageSize.w * scale;
    const imgH = imageSize.h * scale;

    // 이미지 중심 기준으로 crop 영역 계산
    const centerX = imgW / 2 - offset.x;
    const centerY = imgH / 2 - offset.y;

    // 원본 이미지 크기 대비 비율
    Image.getSize(imageUri, (origW, origH) => {
      const scaleX = origW / imgW;
      const scaleY = origH / imgH;

      const cropX = Math.max(0, (centerX - CROP_SIZE / 2) * scaleX);
      const cropY = Math.max(0, (centerY - CROP_SIZE / 2) * scaleY);
      const cropW = Math.min(origW - cropX, CROP_SIZE * scaleX);
      const cropH = Math.min(origH - cropY, CROP_SIZE * scaleY);

      onCrop({
        originX: Math.round(cropX),
        originY: Math.round(cropY),
        width: Math.round(cropW),
        height: Math.round(cropH),
      });
    });
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.container}>
        <Text style={styles.title}>프로필 사진 편집</Text>

        {/* 이미지 + 프레임 */}
        <View style={styles.cropArea}>
          <View style={styles.cropFrame} {...panResponder.panHandlers}>
            <Image
              source={{ uri: imageUri }}
              style={{
                width: imageSize.w * scale,
                height: imageSize.h * scale,
                transform: [{ translateX: offset.x }, { translateY: offset.y }],
              }}
              resizeMode="cover"
            />
          </View>
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={styles.cropHole} />
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom} />
          </View>
        </View>

        {/* 줌 버튼 */}
        <View style={styles.zoomRow}>
          <TouchableOpacity style={[styles.zoomBtn, scale === 1 && styles.zoomActive]} onPress={() => setScale(1)}>
            <Text style={styles.zoomText}>1x</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.zoomBtn, scale === 1.5 && styles.zoomActive]} onPress={() => setScale(1.5)}>
            <Text style={styles.zoomText}>1.5x</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.zoomBtn, scale === 2 && styles.zoomActive]} onPress={() => setScale(2)}>
            <Text style={styles.zoomText}>2x</Text>
          </TouchableOpacity>
        </View>

        {/* 버튼 */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleCrop}>
            <Text style={styles.confirmText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const OVERLAY_COLOR = 'rgba(0,0,0,0.6)';
const sideSize = (SCREEN.width - CROP_SIZE) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  cropArea: { width: SCREEN.width, height: SCREEN.width, position: 'relative' },
  cropFrame: { width: SCREEN.width, height: SCREEN.width, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlayTop: { height: sideSize, backgroundColor: OVERLAY_COLOR },
  overlayMiddle: { flexDirection: 'row', height: CROP_SIZE },
  overlaySide: { width: sideSize, backgroundColor: OVERLAY_COLOR },
  cropHole: { width: CROP_SIZE, height: CROP_SIZE, borderWidth: 2, borderColor: '#fff', borderRadius: CROP_SIZE * 0.3 },
  overlayBottom: { flex: 1, backgroundColor: OVERLAY_COLOR },
  zoomRow: { flexDirection: 'row', marginTop: 20, gap: 12 },
  zoomBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  zoomActive: { backgroundColor: '#FFC107' },
  zoomText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btnRow: { flexDirection: 'row', marginTop: 30, gap: 20 },
  cancelBtn: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.15)' },
  cancelText: { color: '#fff', fontSize: 16 },
  confirmBtn: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, backgroundColor: '#FFC107' },
  confirmText: { color: '#333', fontSize: 16, fontWeight: 'bold' },
});
