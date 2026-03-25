<template>
    <div class="wrap">
        <button
            class="helpBtn"
            type="button"
            title="Горячие клавиши"
            @click="isOpen = !isOpen"
        >
            ?
        </button>

        <div v-if="isOpen" class="popup">
            <h4 class="title">Горячие клавиши</h4>

            <div class="columns">
                <div class="column">
                    <h5 class="columnTitle">Инструменты</h5>
                    <ul class="list">
                        <li><span>1</span> — курсор</li>
                        <li><span>2</span> — линия</li>
                        <li><span>3</span> — прямоугольник</li>
                        <li><span>4</span> — круг</li>
                        <li><span>5</span> — треугольник</li>
                        <li><span>6</span> — многоугольник</li>
                        <li><span>7</span> — звезда</li>
                        <li><span>8</span> — шестиугольник</li>
                        <li><span>9</span> — стрелка</li>
                        <li><span>0</span> — ластик</li>
                    </ul>
                </div>

                <div class="column">
                    <h5 class="columnTitle">Другое</h5>
                    <ul class="list">
                        <li><span>+</span> — увеличить масштаб</li>
                        <li><span>-</span> — уменьшить масштаб</li>
                        <li><span>Ctrl + C</span> — копировать фигуру</li>
                        <li><span>Ctrl + V</span> — вставить фигуру</li>
                        <li><span>Ctrl + D</span> — дублировать фигуру</li>
                        <li><span>Delete</span> — удалить фигуру</li>
                        <li><span>Ctrl + Z</span> — отмена</li>
                        <li><span>Ctrl + Shift + Z</span> — повтор</li>
                        <li>
                            <span>Shift + Space</span> — скрыть / показать
                            рабочую область
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const isOpen = ref(false);
</script>

<style scoped>
.wrap {
    position: absolute;
    right: 28px;
    bottom: 14px;
    z-index: 30;
}

.helpBtn {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    font-size: 20px;
    font-weight: 700;
    cursor: pointer;

    display: flex;
    align-items: center;
    justify-content: center;

    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.popup {
    position: absolute;
    right: 0;
    bottom: 54px;

    width: 420px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 10px;

    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.15);
}

.title {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 700;
}

.columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
}

.column {
    display: grid;
    gap: 8px;
}

.columnTitle {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
}

.list {
    list-style: none;
    padding: 0;
    margin: 0;

    display: grid;
    gap: 6px;
}

.list li {
    font-size: 12px;
    line-height: 1.35;
    color: #374151;
}

.list span {
    font-weight: 600;
    margin-right: 6px;
    font-weight: 600;
    color: #111827;
}
</style>
