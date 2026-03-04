package org.editor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootApplication
@EnableMongoRepositories(basePackages = "org.editor.control.dao")
public class EditorApplication {
    public static void main(String[] args) {
        SpringApplication.run(EditorApplication.class, args);
    }
}
