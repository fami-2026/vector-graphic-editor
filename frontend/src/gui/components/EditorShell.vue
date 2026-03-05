<template>
    <div class="editor">
        <div class="stage">
            <div class="canvasRoot">
                <VectorCanvas />
            </div>

            <div class="topLeft">
                <TopLeftActions />
            </div>

            <div class="rightPanel">
                <InspectorPanel />
            </div>

            <div class="bottomCenter">
                <BottomToolbar />
            </div>

            <div class="bottomLeft">
                <BottomLeftControls />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import TopLeftActions from './TopLeftActions.vue';
import InspectorPanel from './InspectorPanel.vue';
import BottomToolbar from './BottomToolbar.vue';
import BottomLeftControls from './BottomLeftControls.vue';
import VectorCanvas from '@/canvas/components/VectorCanvas.vue';
</script>

<style scoped>
.editor {
    height: 100vh;
    width: 100%;
}

.stage {
    position: relative;
    height: 100%;
    width: 100%;
    background: #ffffff;
    overflow: hidden;
}

.canvasRoot {
    position: absolute;
    inset: 0;
}

.topLeft {
    position: absolute;
    top: 14px;
    left: 14px;
}

.rightPanel {
    position: absolute;
    top: 50%;
    right: 18px;
    transform: translateY(-50%);
}

.bottomCenter {
    position: absolute;
    left: 50%;
    bottom: 14px;
    transform: translateX(-50%);
}

.bottomLeft {
    position: absolute;
    left: 14px;
    bottom: 14px;
}
</style>
