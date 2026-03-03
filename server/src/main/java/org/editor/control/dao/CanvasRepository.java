package org.editor.control.dao;

import org.editor.entity.mongo.Canvas;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CanvasRepository extends MongoRepository<Canvas, String> {}
